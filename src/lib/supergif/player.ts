import { Frame, GCExtBlock, ImgBlock, Rect } from './type'
import { Emitter } from './Emitter'
import { Viewer } from './viewer'

interface PlayerQuote {
  overrideLoopMode: boolean
  loopDelay: number
  viewer: Viewer
}
export class Player extends Emitter<['complete']> {
  private i = -1
  iterationCount = 0
  forward = true
  playing = true
  delay: null | number = null
  frameGroup: Array<Frame & Rect> = []
  currentGce?: GCExtBlock
  opacity = 255
  readonly quote: PlayerQuote

  constructor(quote: PlayerQuote) {
    super()
    this.quote = quote
  }

  /**
   * Gets the index of the frame "up next".
   * @returns {number}
   */
  private getNextFrameNo() {
    const delta = this.forward ? 1 : -1
    return (this.i + delta + this.frameGroup.length) % this.frameGroup.length
  }

  private complete = () => {
    this.iterationCount++
    this.emit('complete')
    if (this.quote.overrideLoopMode || this.iterationCount < 1) {
      this.goOn()
    } else {
      this.pause()
    }
  }

  private goOn = () => {
    if (!this.playing) return
    this.putFrameBy(1)
    const delay = this.frameGroup[this.i].delay
    const isComplete = this.getNextFrameNo() === 0
    return isComplete
      ? setTimeout(this.complete, delay + this.quote.loopDelay)
      : setTimeout(this.goOn, delay)
  }

  putFrameBy = (amount: number) => {
    // XXX: Name is confusing.
    this.i = this.i + amount
    this.putFrame()
  }

  private putFrame(flag?: number) {
    if (typeof flag === 'number') {
      this.i = flag
    }
    if (this.i < 0 || this.i >= this.frameGroup.length) {
      this.i = 0
    }
    const frame = this.frameGroup[this.i]
    this.quote.viewer.putDraft(frame.data, frame.leftPos, frame.topPos)
    this.quote.viewer.drawDraft()
  }

  play = () => {
    this.playing = true
    this.goOn()
  }

  pause = () => {
    this.playing = false
  }
  current_frame() {
    return this.i
  }
  move_to = (frame_idx) => {
    this.i = frame_idx
    this.putFrame()
  }

  onFrame = (frame: Frame & Rect) => {
    this.frameGroup.push(frame)
    // 绘制当前帧
    this.quote.viewer.putDraft(frame.data, frame.leftPos, frame.topPos)
    this.quote.viewer.drawDraft()
  }
}
