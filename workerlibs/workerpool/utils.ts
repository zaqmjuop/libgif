export const RUNTIME_API = globalThis.global
  ? ({
      env: 'nodejs',
      global,
      isMainThread:
        (!global.worker_threads || global.worker_threads.isMainThread) &&
        !global.process.connected,
      child_process: global.child_process,
      cpus: global.os.cpus().length
    } as const)
  : globalThis.window
  ? ({
      env: 'browser',
      window,
      Worker: window.Worker,
      isMainThread: true,
      cpus: window.navigator.hardwareConcurrency
    } as const)
  : ({ env: 'browser-worker', isMainThread: false } as const)

// source of inspiration: https://github.com/sindresorhus/require-fool-webpack
export const requireFoolWebpack = eval(
  "typeof require !== 'undefined' " +
    '? require ' +
    ': function (module) { throw new Error(\'Module " + module + " not found.\') }'
)

export const tryRequireWorkerThreads = ()=> {
  try {
    return requireFoolWebpack('worker_threads')
  } catch (error) {
    const isOldVersionNodeJs =
      typeof error === 'object' &&
      error !== null &&
      error.code === 'MODULE_NOT_FOUND'
    if (isOldVersionNodeJs) {
      // no worker_threads available (old version of node.js), fallback to sub-process based workers
    }
    throw error
  }
}

export const ensureWorkerThreads = () => {
  const WorkerThreads = tryRequireWorkerThreads()
  if (!WorkerThreads) {
    throw new Error(
      "WorkerPool: workerType = 'thread' is not supported, Node >= 11.7.0 required"
    )
  }

  return WorkerThreads
}

// get the default worker script
export const getDefaultWorker = () => {
  if (RUNTIME_API.env === 'browser') {
    // test whether the browser supports all features that we need
    if (typeof Blob === 'undefined') {
      throw new Error('Blob not supported by the browser')
    }
    if (!window.URL || typeof window.URL.createObjectURL !== 'function') {
      throw new Error('URL.createObjectURL not supported by the browser')
    }

    // use embedded worker.js
    const blob = new Blob([require('./generated/embeddedWorker')], {
      type: 'text/javascript'
    })
    return window.URL.createObjectURL(blob)
  } else {
    // use external worker.js in current directory
    return __dirname + '/worker.js'
  }
}

export const getNumberInRange = (value: number, min: number, max: number) => {
  if (value < min) {
    return min
  }
  if (value > max) {
    return max
  }
  return value
}