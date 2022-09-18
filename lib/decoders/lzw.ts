import LZWWorker from './lzwWorker.ts?worker'
import { idGetter } from '../utils/idGetter'
import { LZWPayload } from 'lib/type'
const lzwWorker = new LZWWorker()

const getTraceId = idGetter()


export const lzw = async (payload: LZWPayload) => {
  const traceId = getTraceId()
  const promise = new Promise<number[]>((resolve, reject) => {
    lzwWorker.postMessage({ ...payload, traceId })
    const resolveCallback = (e: MessageEvent<{ traceId: number, data: number[] }>) => {
      if (e.data.traceId === traceId) {
        lzwWorker.removeEventListener('message', resolveCallback)
        resolve(e.data.data)
      }
    }
    lzwWorker.addEventListener('message', resolveCallback)
  })
  return promise
}