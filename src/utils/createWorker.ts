const idGetter = () => {
  let id = 0
  return () => `${id++}`
}

export const createWorker = <F extends (...agrs: any[]) => any>(func: F) => {
  const getTraceId = idGetter()

  const onWorkerMessage = async (
    event: MessageEvent<{ traceId: string; args: Parameters<F> }>
  ) => {
    const { traceId, args } = event.data
    const data = await func.apply(void 0, args)
    self.postMessage({ traceId, data })
  }

  const response = `
    const func = ${func.toString()};
    onmessage=${onWorkerMessage.toString()};
  `

  const worker = new Worker(
    `data:application/javascript,${encodeURIComponent(response)}`
  )

  const workerFunc = async (...args: Parameters<F>) => {
    const traceId = getTraceId()
    return new Promise<ReturnType<F>>((resolve) => {
      worker.onmessage = (
        e: MessageEvent<{ traceId: string; data: ReturnType<F> }>
      ) => {
        if (e.data.traceId !== traceId) {
          return
        }
        resolve(e.data.data)
      }

      worker.postMessage({ args, traceId })
    })
  }

  return workerFunc
}
