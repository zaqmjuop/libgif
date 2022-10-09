const MAX_PORTS = 65535

export default class DebugPortAllocator {
  ports: Record<number, true> = Object.create(null)
  length = 0

  nextAvailableStartingAt = (starting: number) => {
    while (this.ports[starting] === true) {
      starting++
    }

    if (starting >= MAX_PORTS) {
      throw new Error(
        'WorkerPool debug port limit reached: ' + starting + '>= ' + MAX_PORTS
      )
    }

    this.ports[starting] = true
    this.length++
    return starting
  }

  releasePort = (port: number) => {
    delete this.ports[port]
    this.length--
  }
}
