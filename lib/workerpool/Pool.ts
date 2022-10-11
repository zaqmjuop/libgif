import Promis from './Promis'
import WorkerHandler  from './WorkerHandler' 
import { useDebugPortAllocator } from './debug-port-allocator'
import { WorkerPoolOptions } from './types'
import { ensureWorkerThreads, RUNTIME_API } from './utils'
const DEBUG_PORT_ALLOCATOR = useDebugPortAllocator()
/**
 * A pool to manage workers
 * @param {String} [script]   Optional worker script
 * @param {WorkerPoolOptions} [options]  See docs
 * @constructor
 */
class Pool {
  script: string | null
  workers: any[] = [] // queue with all workers
  tasks: any[] = [] // queue with tasks awaiting execution
  readonly forkArgs: any[]
  readonly forkOpts: any[]
  debugPortStart: number
  nodeWorker: any
  workerType: string
  maxQueueSize: number
  onCreateWorker: (...args: any[]) => any
  onTerminateWorker: (...args: any[]) => any
  maxWorkers: number
  minWorkers: number
  _boundNext: () => any
  constructor(script: string, options: WorkerPoolOptions) {
    if (typeof script === 'string') {
      this.script = script || null
    } else {
      this.script = null
      options = script
    }

    options = options || {}

    this.forkArgs = Object.freeze(options.forkArgs || [])
    this.forkOpts = Object.freeze(options.forkOpts || {})
    this.debugPortStart = (options as any).debugPortStart || 43210
    this.nodeWorker = (options as any).nodeWorker
    this.workerType =
      options.workerType || (options as any).nodeWorker || 'auto'
    this.maxQueueSize = options.maxQueueSize || Infinity

    this.onCreateWorker = (options.onCreateWorker || (() => null)) as any
    this.onTerminateWorker = (options.onTerminateWorker || (() => null)) as any

    // configuration
    if (options && 'maxWorkers' in options) {
      validateMaxWorkers(options.maxWorkers)
      this.maxWorkers = options.maxWorkers as number
    } else {
      this.maxWorkers = Math.max((RUNTIME_API.cpus || 4) - 1, 1)
    }

    if (options && 'minWorkers' in options) {
      if (options.minWorkers === 'max') {
        this.minWorkers = this.maxWorkers
      } else {
        validateMinWorkers(options.minWorkers)
        this.minWorkers = options.minWorkers as number
        this.maxWorkers = Math.max(this.minWorkers, this.maxWorkers) // in case minWorkers is higher than maxWorkers
      }
      this._ensureMinWorkers()
    }

    this._boundNext = this._next.bind(this)

    if (this.workerType === 'thread') {
      ensureWorkerThreads()
    }
  }
  /**
   * Execute a function on a worker.
   *
   * Example usage:
   *
   *   var pool = new Pool()
   *
   *   // call a function available on the worker
   *   pool.exec('fibonacci', [6])
   *
   *   // offload a function
   *   function add(a, b) {
   *     return a + b
   *   };
   *   pool.exec(add, [2, 4])
   *       .then(function (result) {
   *         console.log(result); // outputs 6
   *       })
   *       .catch(function(error) {
   *         console.log(error);
   *       });
   *
   * @param {String | Function} method  Function name or function.
   *                                    If `method` is a string, the corresponding
   *                                    method on the worker will be executed
   *                                    If `method` is a Function, the function
   *                                    will be stringified and executed via the
   *                                    workers built-in function `run(fn, args)`.
   * @param {Array} [params]  Function arguments applied when calling the function
   * @param {ExecOptions} [options]  Options object
   * @return {Promis.<*, Error>} result
   */
  exec(
    method: string | ((...args: any[]) => any),
    params?: any[],
    options?: any
  ) {
    // validate type of arguments
    if (params && !Array.isArray(params)) {
      throw new TypeError('Array expected as argument "params"')
    }

    if (typeof method === 'string') {
      const resolver = Promis.defer()

      if (this.tasks.length >= this.maxQueueSize) {
        throw new Error('Max queue size of ' + this.maxQueueSize + ' reached')
      }

      // add a new task to the queue
      const tasks = this.tasks
      const task = {
        method: method,
        params: params,
        resolver: resolver,
        timeout: null,
        options: options
      }
      tasks.push(task)

      // replace the timeout method of the Promis with our own,
      // which starts the timer as soon as the task is actually started
      const originalTimeout = resolver.promise.timeout
      resolver.promise.timeout = function timeout(delay) {
        if (tasks.indexOf(task) !== -1) {
          // task is still queued -> start the timer later on
          task.timeout = delay
          return resolver.promise
        } else {
          // task is already being executed -> start timer immediately
          return originalTimeout.call(resolver.promise, delay)
        }
      }

      // trigger task execution
      this._next()

      return resolver.promise
    } else if (typeof method === 'function') {
      // send stringified function and function arguments to worker
      return this.exec('run', [String(method), params])
    } else {
      throw new TypeError('Function or string expected as argument "method"')
    }
  }

  /**
   * Create a proxy for current worker. Returns an object containing all
   * methods available on the worker. The methods always return a Promis.
   *
   * @return {Promis.<Object, Error>} proxy
   */
  proxy() {
    if (arguments.length > 0) {
      throw new Error('No arguments expected')
    }

    const pool = this
    return this.exec('methods').then(function (methods) {
      const proxy = {}

      methods.forEach(function (method) {
        proxy[method] = function () {
          return pool.exec(method, Array.prototype.slice.call(arguments))
        }
      })

      return proxy
    })
  }

  /**
   * Creates new array with the results of calling a provided callback function
   * on every element in this array.
   * @param {Array} array
   * @param {function} callback  Function taking two arguments:
   *                             `callback(currentValue, index)`
   * @return {Promis.<Array>} Returns a Promis which resolves  with an Array
   *                           containing the results of the callback function
   *                           executed for each of the array elements.
   */
  /* TODO: implement map
map = function (array, callback) {
};
*/

  /**
   * Grab the first task from the queue, find a free worker, and assign the
   * worker to the task.
   * @protected
   */
  _next() {
    if (this.tasks.length > 0) {
      // there are tasks in the queue

      // find an available worker
      const worker = this._getWorker()
      if (worker) {
        // get the first task from the queue
        const me = this
        const task = this.tasks.shift()

        // check if the task is still pending (and not cancelled -> Promis rejected)
        if (task.resolver.Promis.pending) {
          // send the request to the worker
          const Promis = worker
            .exec(task.method, task.params, task.resolver, task.options)
            .then(me._boundNext)
            .catch(function () {
              // if the worker crashed and terminated, remove it from the pool
              if (worker.terminated) {
                return me._removeWorker(worker)
              }
            })
            .then(function () {
              me._next() // trigger next task in the queue
            })

          // start queued timer now
          if (typeof task.timeout === 'number') {
            Promis.timeout(task.timeout)
          }
        } else {
          // The task taken was already complete (either rejected or resolved), so just trigger next task in the queue
          me._next()
        }
      }
    }
  }

  /**
   * Get an available worker. If no worker is available and the maximum number
   * of workers isn't yet reached, a new worker will be created and returned.
   * If no worker is available and the maximum number of workers is reached,
   * null will be returned.
   *
   * @return {WorkerHandler | null} worker
   * @private
   */
  _getWorker() {
    // find a non-busy worker
    const workers = this.workers
    for (let i = 0; i < workers.length; i++) {
      const worker = workers[i]
      if (worker.busy() === false) {
        return worker
      }
    }

    if (workers.length < this.maxWorkers) {
      // create a new worker
      const worker = this._createWorkerHandler()
      workers.push(worker)
      return worker
    }

    return null
  }

  /**
   * Remove a worker from the pool.
   * Attempts to terminate worker if not already terminated, and ensures the minimum
   * pool size is met.
   * @param {WorkerHandler} worker
   * @return {Promis<WorkerHandler>}
   * @protected
   */
  _removeWorker(worker) {
    const me = this

    DEBUG_PORT_ALLOCATOR.releasePort(worker.debugPort)
    // _removeWorker will call this, but we need it to be removed synchronously
    this._removeWorkerFromList(worker)
    // If minWorkers set, spin up new workers to replace the crashed ones
    this._ensureMinWorkers()
    // terminate the worker (if not already terminated)
    return new Promis(function (resolve, reject) {
      worker.terminate(false, function (err) {
        me.onTerminateWorker({
          forkArgs: worker.forkArgs,
          forkOpts: worker.forkOpts,
          script: worker.script
        })
        if (err) {
          reject(err)
        } else {
          resolve(worker)
        }
      })
    })
  }

  /**
   * Remove a worker from the pool list.
   * @param {WorkerHandler} worker
   * @protected
   */
  _removeWorkerFromList(worker) {
    // remove from the list with workers
    const index = this.workers.indexOf(worker)
    if (index !== -1) {
      this.workers.splice(index, 1)
    }
  }

  /**
   * Close all active workers. Tasks currently being executed will be finished first.
   * @param {boolean} [force=false]   If false (default), the workers are terminated
   *                                  after finishing all tasks currently in
   *                                  progress. If true, the workers will be
   *                                  terminated immediately.
   * @param {number} [timeout]        If provided and non-zero, worker termination Promis will be rejected
   *                                  after timeout if worker process has not been terminated.
   * @return {Promis.<void, Error>}
   */
  terminate(force, timeout) {
    const me = this

    // cancel any pending tasks
    this.tasks.forEach(function (task) {
      task.resolver.reject(new Error('Pool terminated'))
    })
    this.tasks.length = 0

    const f = function (worker) {
      this._removeWorkerFromList(worker)
    }
    const removeWorker = f.bind(this)

    const Promiss: Promis[] = []
    const workers = this.workers.slice()
    workers.forEach(function (worker) {
      const termPromis = worker
        .terminateAndNotify(force, timeout)
        .then(removeWorker)
        .always(function () {
          me.onTerminateWorker({
            forkArgs: worker.forkArgs,
            forkOpts: worker.forkOpts,
            script: worker.script
          })
        })
      Promiss.push(termPromis)
    })
    return Promis.all(Promiss)
  }

  /**
   * Retrieve statistics on tasks and workers.
   * @return {{totalWorkers: number, busyWorkers: number, idleWorkers: number, pendingTasks: number, activeTasks: number}} Returns an object with statistics
   */
  stats() {
    const totalWorkers = this.workers.length
    const busyWorkers = this.workers.filter(function (worker) {
      return worker.busy()
    }).length

    return {
      totalWorkers: totalWorkers,
      busyWorkers: busyWorkers,
      idleWorkers: totalWorkers - busyWorkers,

      pendingTasks: this.tasks.length,
      activeTasks: busyWorkers
    }
  }

  /**
   * Ensures that a minimum of minWorkers is up and running
   * @protected
   */
  _ensureMinWorkers() {
    if (this.minWorkers) {
      for (let i = this.workers.length; i < this.minWorkers; i++) {
        this.workers.push(this._createWorkerHandler())
      }
    }
  }

  /**
   * Helper function to create a new WorkerHandler and pass all options.
   * @return {WorkerHandler}
   * @private
   */
  _createWorkerHandler() {
    const overridenParams =
      this.onCreateWorker({
        forkArgs: this.forkArgs,
        forkOpts: this.forkOpts,
        script: this.script
      }) || {}

    return new WorkerHandler(overridenParams.script || this.script, {
      forkArgs: overridenParams.forkArgs || this.forkArgs,
      forkOpts: overridenParams.forkOpts || this.forkOpts,
      debugPort: DEBUG_PORT_ALLOCATOR.increasePort(),
      workerType: this.workerType as any
    })
  }
}

/**
 * Ensure that the maxWorkers option is an integer >= 1
 * @param {*} maxWorkers
 * @returns {boolean} returns true maxWorkers has a valid value
 */
function validateMaxWorkers(maxWorkers) {
  if (!isNumber(maxWorkers) || !isInteger(maxWorkers) || maxWorkers < 1) {
    throw new TypeError('Option maxWorkers must be an integer number >= 1')
  }
}

/**
 * Ensure that the minWorkers option is an integer >= 0
 * @param {*} minWorkers
 * @returns {boolean} returns true when minWorkers has a valid value
 */
function validateMinWorkers(minWorkers) {
  if (!isNumber(minWorkers) || !isInteger(minWorkers) || minWorkers < 0) {
    throw new TypeError('Option minWorkers must be an integer number >= 0')
  }
}

/**
 * Test whether a variable is a number
 * @param {*} value
 * @returns {boolean} returns true when value is a number
 */
function isNumber(value) {
  return typeof value === 'number'
}

/**
 * Test whether a number is an integer
 * @param {number} value
 * @returns {boolean} Returns true if value is an integer
 */
function isInteger(value) {
  return Math.round(value) == value
}

export default Pool
