/**
 * worker must be started as a child process or a web worker.
 * It listens for RPC messages from the parent process.
 */
import { TERMINATE_METHOD_ID } from './construct'  
import { func } from './types'
import { requireFoolWebpack, RUNTIME_API } from './utils'

let on: (event: string, listener: func) => any
let send: func
let exit = (code?: number) => void 0

switch (RUNTIME_API.env) {
  case 'browser':
    send = (message) => postMessage(message)
    on = (event, callback) =>
      window.addEventListener(event, (message) =>
        callback((message as any).data)
      )
    break
  case 'nodejs':
    try {
      const WorkerThreads = requireFoolWebpack('worker_threads')
      const parentPort = WorkerThreads.parentPort

      if (parentPort) {
        send = parentPort.postMessage.bind(parentPort)
        on = parentPort.on.bind(parentPort)
      } else {
        on = process.on.bind(process)
        send = process.send!.bind(process)
        // register disconnect handler only for subprocess worker to exit when parent is killed unexpectedly
        on('disconnect', () => process.exit(1))
        exit = process.exit.bind(process)
      }
    } catch (error) {
      const noWorkerThreads =
        typeof error === 'object' &&
        error !== null &&
        error.code === 'MODULE_NOT_FOUND'
      if (!noWorkerThreads) {
        throw error
      }
      // no worker_threads, fallback to sub-process based workers
    }
    break
  default:
    throw new Error('Script must be executed as a worker')
}

const convertError = <T extends Record<string, any>>(error: T): Partial<T> => {
  const res = {}
  Object.getOwnPropertyNames(error).forEach((key) => {
    Object.defineProperty(res, key, {
      value: error[key],
      enumerable: true
    })
  })
  return res
}

/**
 * Test whether a value is a Promise via duck typing.
 * @param {*} value
 * @returns {boolean} Returns true when given value is an object
 *                    having functions `then` and `catch`.
 */
const isPromise = (value: unknown) => {
  return (
    value &&
    typeof (value as any).then === 'function' &&
    typeof (value as any).catch === 'function'
  )
}

type methodMap<F extends (...args: any[]) => any = (...args: any[]) => any> =
  Record<string, (fn: F, args: Parameters<F>) => ReturnType<F>>
// functions available externally
const methodMap: methodMap = {
  run: (fn, args) => {
    const f = new Function('return (' + fn + ').apply(null, arguments);')
    return f.apply(f, args)
  }
}

let currentRequestId = null

on!('message', (request) => {
  if (request === TERMINATE_METHOD_ID) {
    return exit(0)
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
            send({
              id: request.id,
              result: result,
              error: null
            })
            currentRequestId = null
          })
          .catch(function (err) {
            send({
              id: request.id,
              result: null,
              error: convertError(err)
            })
            currentRequestId = null
          })
      } else {
        // immediate result
        send({
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
    send({
      id: request.id,
      result: null,
      error: convertError(err)
    })
  }
})

const register = (funcMap: methodMap) => {
  for (const name in funcMap) {
    if (funcMap.hasOwnProperty(name)) {
      methodMap[name] = funcMap[name]
    }
  }

  send('ready')
}

export const add = register

export const emit = (payload: any) => {
  if (currentRequestId) {
    send({
      id: currentRequestId,
      isEvent: true,
      payload
    })
  }
}
