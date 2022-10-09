import requireFoolWebpack from './requireFoolWebpack'

// source: https://github.com/flexdinesh/browser-or-node
export const isNode = (nodeProcess) => {
  return (
    typeof nodeProcess !== 'undefined' &&
    nodeProcess.versions != null &&
    nodeProcess.versions.node != null
  )
}

const tryRequireFoolWebpack = (module1) => {
  try {
    return requireFoolWebpack(module1)
  } catch (err) {
    return null
  }
}

// determines the JavaScript platform: browser or node
export const platform =
  typeof process !== 'undefined' && isNode(process) ? 'node' : 'browser'

// determines whether the code is running in main thread or not
// note that in node.js we have to check both worker_thread and child_process
const worker_threads = tryRequireFoolWebpack('worker_threads')
export const isMainThread =
  platform === 'node'
    ? (!worker_threads || worker_threads.isMainThread) && !process.connected
    : typeof Window !== 'undefined'

// determines the number of cpus available
export const cpus =
  platform === 'browser'
    ? self.navigator.hardwareConcurrency
    : requireFoolWebpack('os').cpus().length
