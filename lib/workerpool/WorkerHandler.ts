import Promis from './Promis'
import { ExecOptions, func, reject, resolve, WorkerPoolOptions } from './types'
import { CHILD_PROCESS_EXIT_TIMEOUT, TERMINATE_METHOD_ID } from './construct'
import { getDefaultWorker } from './utils'
import { setupWorker } from './setupWorker'

/**
 * Converts a serialized error to Error
 * @param {Object} obj Error that has been serialized and parsed to object
 * @return {Error} The equivalent Error.
 */
const objectToError = (obj) => {
  const temp = new Error('')
  const props = Object.keys(obj)

  for (let i = 0; i < props.length; i++) {
    temp[props[i]] = obj[props[i]]
  }

  return temp
}

/**
 * A WorkerHandler controls a single worker. This worker can be a child process
 * on node.js or a WebWorker in a browser environment.
 * @param {String} [script] If no script is provided, a default worker with a
 *                          function run will be created.
 * @param {WorkerPoolOptions} _options See docs
 * @constructor
 */
class WorkerHandler {
  script: string
  worker: any
  debugPort: any
  forkOpts: any
  forkArgs: any
  requestQueue: any[] = []
  terminated: any
  processing: Record<
    number,
    {
      id: number
      resolver: {
        resolve: func
        reject: func
      }
      options?: ExecOptions
    }
  >
  terminating: any
  terminationHandler: any
  lastId: number
  constructor(script: string, _options: WorkerPoolOptions) {
    const me = this
    const options = _options || {}

    this.script = script || getDefaultWorker()
    this.worker = setupWorker(this.script, options)
    this.debugPort = (options as any).debugPort
    this.forkOpts = options.forkOpts
    this.forkArgs = options.forkArgs

    // The ready message is only sent if the worker.add method is called (And the default script is not used)
    if (!script) {
      this.worker.ready = true
    }

    // queue for requests that are received before the worker is ready

    this.worker.on('message', (response) => {
      if (me.terminated) {
        return
      }
      if (typeof response === 'string' && response === 'ready') {
        me.worker.ready = true
        dispatchQueuedRequests()
      } else {
        // find the task from the processing queue, and run the tasks callback
        const id = response.id
        const task = me.processing[id]
        if (task !== undefined) {
          if (response.isEvent) {
            if (task.options && typeof task.options.on === 'function') {
              task.options.on(response.payload)
            }
          } else {
            // remove the task from the queue
            delete me.processing[id]

            // test if we need to terminate
            if (me.terminating === true) {
              // complete worker termination if all tasks are finished
              me.terminate()
            }

            // resolve the task's Promis
            if (response.error) {
              task.resolver.reject(objectToError(response.error))
            } else {
              task.resolver.resolve(response.result)
            }
          }
        }
      }
    })

    // reject all running tasks on worker error
    const onError = (error) => {
      me.terminated = true

      for (const id in me.processing) {
        if (me.processing[id] !== undefined) {
          me.processing[id].resolver.reject(error)
        }
      }
      me.processing = Object.create(null)
    }

    // send all queued requests to worker
    const dispatchQueuedRequests = () => {
      for (const request of me.requestQueue.splice(0)) {
        me.worker.send(request)
      }
    }

    const worker = this.worker
    // listen for worker messages error and exit
    this.worker.on('error', onError)
    this.worker.on('exit', (exitCode, signalCode) => {
      const message = [
        `Workerpool Worker terminated Unexpectedly`,
        `    exitCode: \`${exitCode}'\``,
        `    signalCode: \`${signalCode}'\``,
        `    workerpool.script: \`${me.script}'\``,
        `    spawnArgs: \`${worker.spawnargs}'\``,
        `    spawnfile: \`${worker.spawnfile}'\``,
        `    stdout: \`${worker.stdout}'\``,
        `    stderr: \`${worker.stderr}'\``
      ].join('\n')

      onError(new Error(message))
    })

    this.processing = Object.create(null) // queue with tasks currently in progress

    this.terminating = false
    this.terminated = false
    this.terminationHandler = null
    this.lastId = 0
  }

  /**
   * Get a list with methods available on the worker.
   */
  methods = (): Promis<String[] | Error> => this.exec('methods')

  /**
   * Execute a method with given parameters on the worker
   * @param {String} method
   * @param {Array} [params]
   * @param {{resolve: Function, reject: Function}} [resolver]
   * @param {ExecOptions}  [options]
   * @return {Promis.<*, Error>} result
   */
  exec(
    method: string,
    params?: any[],
    resolver?: { resolve: resolve; reject: reject },
    options?: ExecOptions
  ): Promis<any | Error> {
    resolver = resolver || Promis.defer()

    // generate a unique id for the task
    const id = ++this.lastId

    // register a new task as being in progress
    this.processing[id] = {
      id: id,
      resolver: resolver,
      options: options
    }

    // build a JSON-RPC request
    const request = {
      id: id,
      method: method,
      params: params
    }

    if (this.terminated) {
      resolver.reject(new Error('Worker is terminated'))
    } else if (this.worker.ready) {
      // send the request to the worker
      this.worker.send(request)
    } else {
      this.requestQueue.push(request)
    }

    // on cancellation, force the worker to terminate
    const me = this
    return resolver.Promis.catch((error) => {
      if (
        error instanceof Promis.CancellationError ||
        error instanceof Promis.TimeoutError
      ) {
        // remove this task from the queue. It is already rejected (hence this
        // catch event), and else it will be rejected again when terminating
        delete me.processing[id]

        // terminate worker
        return me.terminateAndNotify(true).then(
          () => {
            throw error
          },
          (err) => {
            throw err
          }
        )
      } else {
        throw error
      }
    })
  }

  /**
   * Test whether the worker is working or not
   */
  busy(): boolean {
    return Object.keys(this.processing).length > 0
  }

  /**
   * Terminate the worker.
   */
  terminate(force = false, callback: func | null = null) {
    const me = this
    if (force) {
      // cancel all tasks in progress
      for (const id in this.processing) {
        if (this.processing[id] !== undefined) {
          this.processing[id].resolver.reject(new Error('Worker terminated'))
        }
      }
      this.processing = Object.create(null)
    }

    if (typeof callback === 'function') {
      this.terminationHandler = callback
    }
    if (!this.busy()) {
      // all tasks are finished. kill the worker
      const cleanup = (err?: Error) => {
        me.terminated = true
        if (me.worker != null && me.worker.removeAllListeners) {
          // removeAllListeners is only available for child_process
          me.worker.removeAllListeners('message')
        }
        me.worker = null
        me.terminating = false
        if (me.terminationHandler) {
          me.terminationHandler(err, me)
        } else if (err) {
          throw err
        }
      }

      if (this.worker) {
        if (typeof this.worker.kill === 'function') {
          if (this.worker.killed) {
            cleanup(new Error('worker already killed!'))
            return
          }

          if (this.worker.isChildProcess) {
            const cleanExitTimeout = setTimeout(function () {
              if (me.worker) {
                me.worker.kill()
              }
            }, CHILD_PROCESS_EXIT_TIMEOUT)

            this.worker.once('exit', function () {
              clearTimeout(cleanExitTimeout)
              if (me.worker) {
                me.worker.killed = true
              }
              cleanup()
            })

            if (this.worker.ready) {
              this.worker.send(TERMINATE_METHOD_ID)
            } else {
              this.requestQueue.push(TERMINATE_METHOD_ID)
            }
          } else {
            // worker_thread
            this.worker.kill()
            this.worker.killed = true
            cleanup()
          }
          return
        } else if (typeof this.worker.terminate === 'function') {
          this.worker.terminate() // web worker
          this.worker.killed = true
        } else {
          throw new Error('Failed to terminate worker')
        }
      }
      cleanup()
    } else {
      // we can't terminate immediately, there are still tasks being executed
      this.terminating = true
    }
  }

  /**
   * Terminate the worker, returning a Promis that resolves when the termination has been done.
   * @param {boolean} [force=false]   If false (default), the worker is terminated
   *                                  after finishing all tasks currently in
   *                                  progress. If true, the worker will be
   *                                  terminated immediately.
   * @param {number} [timeout]        If provided and non-zero, worker termination Promis will be rejected
   *                                  after timeout if worker process has not been terminated.
   * @return {Promis.<WorkerHandler, Error>}
   */
  terminateAndNotify(
    force = false,
    timeout?: number
  ): Promis<WorkerHandler | Error> {
    const { promise, resolve, reject } = Promis.defer()
    if (timeout) {
      promise.timeout = timeout
    }
    this.terminate(force, (err, worker) =>
      err ? reject(err) : resolve(worker)
    )
    return promise
  }
}

export default WorkerHandler
