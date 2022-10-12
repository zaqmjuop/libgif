import { workerType } from './types'
import {
  ensureWorkerThreads,
  RUNTIME_API,
  requireFoolWebpack,
  tryRequireWorkerThreads
} from './utils'
// check whether Worker is supported by the browser
const ensureWebWorker = () => {
  // Workaround for a bug in PhantomJS (Or QtWebkit): https://github.com/ariya/phantomjs/issues/14534
  if (typeof Worker === 'function') {
    return Worker
  }
  if (
    typeof Worker === 'object' &&
    typeof (Worker as any).prototype.constructor === 'function'
  ) {
    return Worker
  }
  throw new Error('WorkerPool: Web Workers not supported')
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

const setupWorkerThreadWorker = (script: string) => {
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

const setupProcessWorker = (script, options) => {
  const child_process = requireFoolWebpack('child_process')
  // no WorkerThreads, fallback to sub-process based workers
  const worker = child_process.fork(script, options.forkArgs, options.forkOpts)
  return worker
}

// add debug flags to child processes if the node inspector is active
const resolveForkOptions = (opts: {
  debugPort: number
  forkArgs: any
  forkOpts: any
}) => {
  const execArgv: string[] = process.execArgv
    .map((str) => {
      if (str.indexOf('--inspect') !== -1) {
        return '--inspect=' + opts.debugPort
      } else if (str.indexOf('--debug-brk') !== -1) {
        return '--debug-brk'
      } else if (str.indexOf('--max-old-space-size') > -1) {
        return str
      }
      return ''
    })
    .filter((str) => !!str)

  return Object.assign({}, opts, {
    forkArgs: opts.forkArgs,
    forkOpts: Object.assign({}, opts.forkOpts, {
      execArgv: ((opts.forkOpts && opts.forkOpts.execArgv) || []).concat(
        execArgv
      )
    })
  })
}

export const setupWorker = (script, options: { workerType?: workerType }) => {
  const workerType: workerType = options.workerType || 'process'
  switch (workerType) {
    case 'web':
      return setupBrowserWorker(script)
    case 'thread':
      return setupWorkerThreadWorker(script)
    case 'process':
      return setupProcessWorker(script, resolveForkOptions(options))

    default:
      return RUNTIME_API.env === 'browser'
        ? setupBrowserWorker(script)
        : tryRequireWorkerThreads()
        ? setupWorkerThreadWorker(script)
        : setupProcessWorker(script, resolveForkOptions(options))
  }
}