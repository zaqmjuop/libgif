import { idGetter } from '../utils/idGetter'
// import Worker from './funcWorker.ts?worker'
import { FUNC_MAP } from './funcWorker'

const WorkerFuncGenerator = <N extends keyof typeof FUNC_MAP = ''>(
  funcName: N
) => {
  type argsType = Parameters<typeof FUNC_MAP[N]>
  type resType = ReturnType<typeof FUNC_MAP[N]>
  const worker = new Worker(new URL('./funcWorker.ts', import.meta.url), {
    type: 'module'
  })

  const getTraceId = idGetter()

  const workerFunc = async (...args: argsType) => {
    const traceId = getTraceId()
    return new Promise<resType>((resolve) => {
      const resolveCallback = (
        e: MessageEvent<{ traceId: number; data: resType }>
      ) => {
        if (e.data.traceId !== traceId) {
          return
        }
        worker.removeEventListener('message', resolveCallback)
        resolve(e.data.data)
      }
      worker.addEventListener('message', resolveCallback)

      worker.postMessage({ args, traceId, funcName })
    })
  }
  return workerFunc
}

export const WORKER_FUNC_MAP = {
  '': WorkerFuncGenerator(''),
  lzwDecode: WorkerFuncGenerator('lzwDecode')
} as const
