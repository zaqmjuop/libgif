import { lzwDecode } from './lzwDecode'

export const FUNC_MAP = {
  '': () => {},
  lzwDecode
} as const

interface Payload<N extends keyof typeof FUNC_MAP = ''> {
  funcName: string
  args: Parameters<typeof FUNC_MAP[N]>
  traceId: number
}

self.addEventListener('message', async (e: MessageEvent<Payload>) => {
  const { traceId, args, funcName } = e.data
  const data = await FUNC_MAP[funcName](...args)
  self.postMessage({ traceId, data })
})
