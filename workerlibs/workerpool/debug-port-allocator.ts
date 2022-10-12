const MAX_PORTS = 65534

export const useDebugPortAllocator = () => {
  const ports: Array<0 | 1> = []
  let index = 0
  const increasePort = () => {
    index++
    if (index >= MAX_PORTS) {
      throw new Error(
        'WorkerPool debug port limit reached: ' + index + '>= ' + MAX_PORTS
      )
    }
    ports[index] = 1
    return index
  }

  const releasePort = (index: number) => {
    ports[index] = 0
  }
  return { increasePort, releasePort }
}
