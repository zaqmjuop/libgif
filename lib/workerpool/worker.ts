/**
 * worker must be started as a child process or a web worker.
 * It listens for RPC messages from the parent process.
 */

// source of inspiration: https://github.com/sindresorhus/require-fool-webpack
const requireFoolWebpack = eval(
  "typeof require !== 'undefined'" +
    ' ? require' +
    ' : function (module) { throw new Error(\'Module " + module + " not found.\') }'
)

/**
 * Special message sent by parent which causes the worker to terminate itself.
 * Not a "message object"; this string is the entire message.
 */
const TERMINATE_METHOD_ID = '__workerpool-terminate__'

// const nodeOSPlatform = require('./environment').nodeOSPlatform;
// create a worker API for sending and receiving messages which works both on
// node.js and in the browser
const worker = {
  exit: (code?: number | undefined) => void 0,
  send: void 0 as any,
  on: void 0 as any
}

if (
  typeof self !== 'undefined' &&
  typeof postMessage === 'function' &&
  typeof addEventListener === 'function'
) {
  // worker in the browser
  worker.send = (message) => {
    postMessage(message)
  }
  worker.on = (event, callback) => {
    self.addEventListener(event, (message) => {
      callback(message.data)
    })
  }
} else if (typeof process !== 'undefined') {
  // node.js

  let WorkerThreads
  try {
    WorkerThreads = requireFoolWebpack('worker_threads')
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      error.code === 'MODULE_NOT_FOUND'
    ) {
      // no worker_threads, fallback to sub-process based workers
    } else {
      throw error
    }
  }

  if (
    WorkerThreads &&
    /* if there is a parentPort, we are in a WorkerThread */
    WorkerThreads.parentPort !== null
  ) {
    const parentPort = WorkerThreads.parentPort
    worker.send = parentPort.postMessage.bind(parentPort)
    worker.on = parentPort.on.bind(parentPort)
  } else {
    worker.on = process.on.bind(process)
    worker.send = process.send!.bind(process)
    // register disconnect handler only for subprocess worker to exit when parent is killed unexpectedly
    worker.on('disconnect', () => {
      process.exit(1)
    })
    worker.exit = process.exit.bind(process)
  }
} else {
  throw new Error('Script must be executed as a worker')
}

function convertError(error) {
  return Object.getOwnPropertyNames(error).reduce(function (product, name) {
    return Object.defineProperty(product, name, {
      value: error[name],
      enumerable: true
    })
  }, {})
}

/**
 * Test whether a value is a Promise via duck typing.
 * @param {*} value
 * @returns {boolean} Returns true when given value is an object
 *                    having functions `then` and `catch`.
 */
function isPromise(value) {
  return (
    value &&
    typeof value.then === 'function' &&
    typeof value.catch === 'function'
  )
}

// functions available externally
const methodMap = {
  run: (fn: Function, args: any[]) => {
    const f = new Function('return (' + fn + ').apply(null, arguments);')
    return f.apply(f, args)
  }
}

let currentRequestId = null

worker.on('message', function (request) {
  if (request === TERMINATE_METHOD_ID) {
    return worker.exit(0)
  }
  try {
    const method = methodMap[request.method]

    if (method) {
      currentRequestId = request.id

      // execute the function
      const result = method.apply(method, request.params)

      if (isPromise(result)) {
        // promise returned, resolve this and then return
        result
          .then(function (result) {
            worker.send({
              id: request.id,
              result: result,
              error: null
            })
            currentRequestId = null
          })
          .catch(function (err) {
            worker.send({
              id: request.id,
              result: null,
              error: convertError(err)
            })
            currentRequestId = null
          })
      } else {
        // immediate result
        worker.send({
          id: request.id,
          result: result,
          error: null
        })

        currentRequestId = null
      }
    } else {
      throw new Error('Unknown method "' + request.method + '"')
    }
  } catch (err) {
    worker.send({
      id: request.id,
      result: null,
      error: convertError(err)
    })
  }
})

const register = (funcMap: Record<string, Function>) => {
  for (const name in funcMap) {
    if (funcMap.hasOwnProperty(name)) {
      methodMap[name] = funcMap[name]
    }
  }

  worker.send('ready')
}

export const add = register

export const emit = (payload: any) => {
  if (currentRequestId) {
    worker.send({
      id: currentRequestId,
      isEvent: true,
      payload
    })
  }
}
