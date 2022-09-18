import { lzwDecode } from './lzwDecode'

type paramType = Parameters<typeof lzwDecode>

self.addEventListener('message', (e: MessageEvent<{ traceId: number, args: paramType }>) => {
  const { traceId, args } = e.data
  self.postMessage({ traceId, data: lzwDecode(...args) })
}) 