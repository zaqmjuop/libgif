import Promis from './Promis'
import { func, WorkerPoolOptions, workerType } from './types'
import { CHILD_PROCESS_EXIT_TIMEOUT, TERMINATE_METHOD_ID } from './construct'
import {
  ensureWebWorker,
  ensureWorkerThreads,
  getDefaultWorker,
  requireFoolWebpack,
  RUNTIME_API,
  tryRequireWorkerThreads
} from './utils'

const setupWorker = (script, options: { workerType?: workerType }) => {
  const workerType: workerType = options.workerType || 'process' 
  switch (workerType) {
    case 'web':
      return setupBrowserWorker(script)
    case 'thread':
      return setupWorkerThreadWorker(script)
    case 'process':
      return setupProcessWorker(
        script,
        resolveForkOptions(options),
        requireFoolWebpack('child_process')
      )

    default:
      return RUNTIME_API.env === 'browser'
        ? setupBrowserWorker(script)
        : ( tryRequireWorkerThreads()
        ? setupWorkerThreadWorker(script)
        : setupProcessWorker(
            script,
            resolveForkOptions(options),
            requireFoolWebpack('child_process'))
  }
}
const setupBrowserWorker = (script: string) => {
  ensureWebWorker()
  const worker = new window.Worker(script)
  // add node.js API to the web worker
  ;(worker as any).on = (event, callback) =>
    self.addEventListener(event, (message) => callback(message.data))
  ;(worker as any).send = (message) => self.postMessage(message)
  return worker
}

const setupWorkerThreadWorker = (script) => {
  ensureWorkerThreads()
  const worker = new global.worker_threads.Worker(script, {
    stdout: false, // automatically pipe worker.STDOUT to process.STDOUT
    stderr: false // automatically pipe worker.STDERR to process.STDERR
  })
  // make the worker mimic a child_process
  worker.send = (message) => global.postMessage(message)

  worker.kill = () => {
    global.terminate()
    return true
  }

  worker.disconnect = () => global.terminate()

  return worker
}

const setupProcessWorker = (script, options, child_process) => {
  // no WorkerThreads, fallback to sub-process based workers
  const worker = child_process.fork(script, options.forkArgs, options.forkOpts)
  return worker
}

// add debug flags to child processes if the node inspector is active
const resolveForkOptions = (opts) => {
  opts = opts || {}

  const processExecArgv = process.execArgv.join(' ')
  const inspectorActive = processExecArgv.indexOf('--inspect') !== -1
  const debugBrk = processExecArgv.indexOf('--debug-brk') !== -1

  const execArgv: string[] = []
  if (inspectorActive) {
    execArgv.push('--inspect=' + opts.debugPort)

    if (debugBrk) {
      execArgv.push('--debug-brk')
    }
  }

  process.execArgv.forEach(function (arg) {
    if (arg.indexOf('--max-old-space-size') > -1) {
      execArgv.push(arg)
    }
  })

  return Object.assign({}, opts, {
    forkArgs: opts.forkArgs,
    forkOpts: Object.assign({}, opts.forkOpts, {
      execArgv: ((opts.forkOpts && opts.forkOpts.execArgv) || []).concat(
        execArgv
      )
    })
  })
}

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
  processing: any
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

    this.worker.on('message', function (response) {
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
    function onError(error) {
      me.terminated = true

      for (const id in me.processing) {
        if (me.processing[id] !== undefined) {
          me.processing[id].resolver.reject(error)
        }
      }
      me.processing = Object.create(null)
    }

    // send all queued requests to worker
    function dispatchQueuedRequests() {
      for (const request of me.requestQueue.splice(0)) {
        me.worker.send(request)
      }
    }

    const worker = this.worker
    // listen for worker messages error and exit
    this.worker.on('error', onError)
    this.worker.on('exit', function (exitCode, signalCode) {
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
   * @return {Promis.<String[], Error>} methods
   */
  methods() {
    return this.exec('methods')
  }

  /**
   * Execute a method with given parameters on the worker
   * @param {String} method
   * @param {Array} [params]
   * @param {{resolve: Function, reject: Function}} [resolver]
   * @param {ExecOptions}  [options]
   * @return {Promis.<*, Error>} result
   */
  exec(method, params?, resolver?, options?) {
    if (!resolver) {
      resolver = Promis.defer()
    }

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
    return resolver.Promis.catch(function (error) {
      if (
        error instanceof Promis.CancellationError ||
        error instanceof Promis.TimeoutError
      ) {
        // remove this task from the queue. It is already rejected (hence this
        // catch event), and else it will be rejected again when terminating
        delete me.processing[id]

        // terminate worker
        return me.terminateAndNotify(true).then(
          function () {
            throw error
          },
          function (err) {
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
   * @return {boolean} Returns true if the worker is busy
   */
  busy() {
    return Object.keys(this.processing).length > 0
  }

  /**
   * Terminate the worker.
   * @param {boolean} [force=false]   If false (default), the worker is terminated
   *                                  after finishing all tasks currently in
   *                                  progress. If true, the worker will be
   *                                  terminated immediately.
   * @param {function} [callback=null] If provided, will be called when process terminates.
   */
  terminate(force?, callback?) {
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
      const cleanup = function (err?: Error) {
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
    const resolver = Promis.defer()
    if (timeout) {
      resolver.promise.timeout = timeout
    }
    this.terminate(force, (err, worker) => {
      if (err) {
        resolver.reject(err)
      } else {
        resolver.resolve(worker)
      }
    })
    return resolver.promise
  }
}

export default WorkerHandler