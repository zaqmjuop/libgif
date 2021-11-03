import { GifFrame } from "./gifParser"

export class Player {
  el: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  frames: GifFrame[]
  imageDatas: ImageData[] = []
  flag = 0
  playing = false
  constructor(el: HTMLCanvasElement, frames: GifFrame[]) {
    const ctx = el.getContext('2d')
    if (!ctx) {
      throw new Error('canvas有问题')
    }
    this.el = el
    this.ctx = ctx
    this.frames = frames
  }
  play() {
    this.playing = true
    this.step()
  }
  pause() {
    this.playing = false
  }
  step() {
    if (!this.playing) {
      return
    }
    if (this.flag >= this.frames.length) {
      this.flag = 0
    }
    const frame = this.frames[this.flag]
    const { imageData, width, height, delayTime } = frame
    setTimeout(() => {
      this.ctx.putImageData(imageData, 0, 0, 0, 0, width, height)
      this.flag++
      this.step()
    }, delayTime * 10)
  }
}