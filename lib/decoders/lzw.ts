import LZWWorker from './lzwWorker.ts?worker'
import { idGetter } from '../utils/idGetter'
import { lzwDecode } from './lzwDecode'
const lzwWorker = new LZWWorker()

const getTraceId = idGetter()

type paramType = Parameters<typeof lzwDecode>


export const lzw = async (...args: paramType) => {
  const traceId = getTraceId()
  const promise = new Promise<number[]>((resolve, reject) => {
    const resolveCallback = (e: MessageEvent<{ traceId: number, data: number[] }>) => {
      if (e.data.traceId === traceId) {
        lzwWorker.removeEventListener('message', resolveCallback)
        resolve(e.data.data)
      }
    }
    lzwWorker.addEventListener('message', resolveCallback)
    lzwWorker.postMessage({ args, traceId })
  })
  return promise
}