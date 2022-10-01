const idGetter = () => {
  let id = 0
  return () => `${id++}`
}

interface WorkerFuncPayload<T extends any[] = []> {
  traceId: string
  args: T
}

export const createWorker = <F extends (...agrs: any[]) => any>(func: F) => {
  const getTraceId = idGetter()

  console.log('func', func.toString())

  const onWorkerMessage = async (
    event: MessageEvent<{ traceId: string; args: Parameters<F> }>
  ) => {
    const { traceId, args } = event.data
    const data = await func.apply(void 0, args)
    self.postMessage({ traceId, data })
  }

  const response = `
  const func = ${func.toString()};
  onmessage=${onWorkerMessage.toString()};`
  console.log('response', response)

  const worker = new Worker(
    `data:application/javascript,${encodeURIComponent(response)}`
  )

  const workerFunc = async (...args: Parameters<F>) => {
    const traceId = getTraceId()
    return new Promise<ReturnType<F>>((resolve) => {
      const resolveCallback = (
        e: MessageEvent<{ traceId: string; data: ReturnType<F> }>
      ) => {
        if (e.data.traceId !== traceId) {
          return
        }
        worker.removeEventListener('message', resolveCallback)
        resolve(e.data.data)
      }
      worker.addEventListener('message', resolveCallback)

      worker.postMessage({ args, traceId })
    })
  }

  return workerFunc
}
