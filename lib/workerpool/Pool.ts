import Promis from './Promis'
import WorkerHandler from './WorkerHandler'
import { useDebugPortAllocator } from './debug-port-allocator'
import { ExecOptions, func, Task, WorkerPoolOptions, workerType } from './types'
import { ensureWorkerThreads, getNumberInRange, RUNTIME_API } from './utils'
const DEBUG_PORT_ALLOCATOR = useDebugPortAllocator()

const MAX_WORKER_COUNT = (RUNTIME_API.cpus || 4) - 1
const MIN_WORKER_COUNT = 0
const DEFAULT_WORKER_COUNT = (RUNTIME_API.cpus || 4) >> 1

/**
 * A pool to manage workers
 * @param {String} [script]   Optional worker script
 * @param {WorkerPoolOptions} [options]  See docs
 * @constructor
 */
class Pool {
  script?: string
  workers: WorkerHandler[] = [] // queue with all workers
  tasks: Task[] = [] // queue with tasks awaiting execution
  readonly forkArgs: any[]
  readonly forkOpts: Record<string, any>
  readonly workerType: workerType
  readonly maxWorkers: number
  readonly minWorkers: number
  constructor(options: WorkerPoolOptions = {}) {
    this.script = options.script

    this.forkArgs = options.forkArgs || []
    this.forkOpts = options.forkOpts || {}
    this.workerType = options.workerType || 'auto'

    // configuration
    this.maxWorkers = getNumberInRange(
      Math.trunc(options.maxWorkers || DEFAULT_WORKER_COUNT),
      MIN_WORKER_COUNT,
      MAX_WORKER_COUNT
    )

    this.minWorkers = getNumberInRange(
      Math.trunc(options.maxWorkers || MIN_WORKER_COUNT),
      MIN_WORKER_COUNT,
      this.maxWorkers
    )

    this._ensureMinWorkers()
    if (this.workerType === 'thread') {
      ensureWorkerThreads()
    }
  }

  private _ensureMinWorkers() {
    const needCount = Math.max(
      Math.trunc(this.minWorkers - this.workers.length),
      0
    )
    for (let i = 0; i < needCount; i++) {
      this.workers.push(this.createWorker())
    }
  }

  private createWorker(): WorkerHandler {
    return new WorkerHandler(this.script || '', {
      forkArgs: this.forkArgs,
      forkOpts: this.forkOpts,
      debugPort: DEBUG_PORT_ALLOCATOR.increasePort(),
      workerType: this.workerType as any
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
   */
  private _next = () => {
    if (!this.tasks.length) {
      return
    }
    // there are tasks in the queue
    // find an available worker
    const worker = this.takeAvailableWorker()
    if (!worker) {
      return
    }
    // get the first task from the queue
    const task = this.tasks.shift()

    // check if the task is still pending (and not cancelled -> Promis rejected)
    if (!task.resolver.Promis.pending) {
      // The task taken was already complete (either rejected or resolved), so just trigger next task in the queue
      return this._next()
    }
    // send the request to the worker
    const Promis = worker
      .exec(task.method, task.params, task.resolver, task.options)
      .then(this._next)
      // if the worker crashed and terminated, remove it from the pool
      .catch(() => worker.terminated && this._removeWorker(worker))
      .then(this._next)

    // start queued timer now
    if (typeof task.timeout === 'number') {
      return Promis.timeout(task.timeout)
    }
  }

  private takeAvailableWorker(): WorkerHandler | void {
    const availableWorkerIndex = this.workers.findIndex(
      (worker) => worker.busy() === false
    )
    if (availableWorkerIndex > -1) {
      const worker = this.workers.splice(availableWorkerIndex, 1)[0]
      this.workers.push(worker)
      return worker
    } else if (this.workers.length < this.maxWorkers) {
      const worker = this.createWorker()
      this.workers.push(worker)
      return worker
    }
  }

  private _removeWorker(worker: WorkerHandler): Promis<WorkerHandler> {
    DEBUG_PORT_ALLOCATOR.releasePort(worker.debugPort)
    this.removeWorker(worker)
    this._ensureMinWorkers()
    return new Promis((resolve, reject) => {
      worker.terminate(false, (err) => {
        err ? reject(err) : resolve(worker)
      })
    })
  }

  private removeWorker = (worker: WorkerHandler) => {
    const index = this.workers.indexOf(worker)
    index !== -1 && this.workers.splice(index, 1)
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
    method: string | func,
    params?: any[],
    options?: ExecOptions
  ): Promis<any | Error> {
    if (typeof method === 'function') {
      // send stringified function and function arguments to worker
      return this.exec('run', [String(method), params])
    }

    const resolver = Promis.defer()

    // add a new task to the queue
    const task = {
      method: method,
      params: params,
      resolver: resolver,
      timeout: 100,
      options: options
    }
    this.tasks.push(task)

    // replace the timeout method of the Promis with our own,
    // which starts the timer as soon as the task is actually started
    const originalTimeout = resolver.promise.timeout
    resolver.promise.timeout = (delay: number) => {
      if (this.tasks.indexOf(task) !== -1) {
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
  }

  /**
   * Close all active workers. Tasks currently being executed will be finished first.
   * @param {boolean} [force=false]   If false (default), the workers are terminated
   *                                  after finishing all tasks currently in
   *                                  progress. If true, the workers will be
   *                                  terminated immediately.
   * @param {number} [timeout]        If provided and non-zero, worker termination Promis will be rejected
   *                                  after timeout if worker process has not been terminated.
 
   */
  terminate = (force = false, timeout: number): Promis<void | Error> => {
    // cancel any pending tasks
    this.tasks.forEach((task) =>
      task.resolver.reject(new Error('Pool terminated'))
    )
    this.tasks.length = 0

    const Promiss: Promis[] = []
    const workers = this.workers.slice()
    workers.forEach((worker) => {
      const termPromis = worker
        .terminateAndNotify(force, timeout)
        .then(this.removeWorker)
      Promiss.push(termPromis)
    })
    return Promis.all(Promiss)
  }
}

export default Pool
