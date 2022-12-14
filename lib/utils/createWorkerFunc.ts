import { idGetter } from './idGetter'

export const createWorkerFunc = <F extends (...agrs: any[]) => any>(
  func: F
) => {
  const getTraceId = idGetter()

  const response = `
    const func = ${func.toString()};
    onmessage= async (event) => {
      const { traceId, args } = event.data
      const data = await func.apply(void 0, args)
      self.postMessage({ traceId, data })
    };
  `

  const worker = new Worker(
    `data:application/javascript,${encodeURIComponent(response)}`
  )

  const workerFunc = async (...args: Parameters<F>) => {
    const traceId = getTraceId()
    return new Promise<ReturnType<F>>((resolve) => {
      const hander = (
        e: MessageEvent<{ traceId: string; data: ReturnType<F> }>
      ) => {
        if (e.data.traceId !== traceId) {
          return
        }
        worker.removeEventListener('message', hander)
        resolve(e.data.data)
      }
      worker.addEventListener('message', hander)

      worker.postMessage({ args, traceId })
    })
  }

  return workerFunc
}
