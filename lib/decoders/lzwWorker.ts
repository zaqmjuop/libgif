import { lzwDecode } from './lzwDecode'
import { LZWPayload } from '../type'

self.addEventListener('message', (e: MessageEvent<LZWPayload & { traceId: number }>) => {
  const res = lzwDecode(e.data.minCodeSize, e.data.data)
  self.postMessage({ traceId: e.data.traceId, data: res })
}) 