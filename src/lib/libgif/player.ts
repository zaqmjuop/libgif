const forward = true
export class Player {
  i = -1
  iterationCount = 0
  getNextFrameNo() {
    const delta = forward ? 1 : -1
    return (this.i + delta + frames.length) % frames.length
  }
}
