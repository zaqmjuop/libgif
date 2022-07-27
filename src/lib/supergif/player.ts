import { Frame, Gif89aData, ImgBlock, Rect } from './type'
import { Emitter } from './Emitter'
import { Viewer } from './viewer'

interface PlayerQuote {
  overrideLoopMode: boolean
  gifData: Gif89aData
  lastDisposalMethod: number | null
  loopDelay: number
  auto_play: boolean | undefined
  viewer: Viewer
}
// Disposal method indicates the way in which the graphic is to be treated after being displayed.
enum DisposalMethod {
  ignore = 0, // No disposal specified. The decoder is not required to take any action.
  skip = 1, // Do not dispose. The graphic is to be left in place.
  backgroundColor = 2, //  Restore to background color. The area used by the graphic must be restored to the background color.
  previous = 3 // Restore to previous. The decoder is required to restore the area overwritten by the graphic with what was there prior to rendering the graphic.
} // Importantly, "previous" means the frame state after the last disposal of method 0, 1, or 2.

export class Player extends Emitter<['complete', 'putFrame', 'init']> {
  private i = -1
  iterationCount = 0
  forward = true
  playing = true
  delay: null | number = null

  lastImg?: Rect & Partial<ImgBlock>
  frameGroup: Frame[] = []
  readonly quote: PlayerQuote

  constructor(quote: PlayerQuote) {
    super()
    this.quote = quote
  }

  get disposalRestoreFromIdx() {
    return this.frameGroup.length - 1
  }

  get move_relative() {
    return this.putFrameBy
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
    const delay = (this.delay || 1.666) * 10
    const isComplete = this.getNextFrameNo() === 0
    return isComplete
      ? setTimeout(this.complete, delay + this.quote.loopDelay)
      : setTimeout(this.goOn, delay)
  }

  private putFrameBy(amount: number) {
    // XXX: Name is confusing.
    this.i = this.i + amount
    this.putFrame()
  }

  putFrame(flag?: number) {
    if (typeof flag === 'number') {
      this.i = flag
    }
    if (this.i < 0 || this.i > this.frameGroup.length - 1) {
      this.i = 0
    }
    const data = this.quote.viewer.frames[this.i].data
    this.emit('putFrame', { flag: this.i, data })
  }

  play() {
    this.playing = true
    this.goOn()
  }

  pause() {
    this.playing = false
  }
  init() {
    this.emit('init')
    this.quote.auto_play ? this.play() : this.putFrame(0)
  }
  current_frame() {
    return this.i
  }
  move_to(frame_idx) {
    this.i = frame_idx
    this.putFrame()
  }
  disposal(method: number | null) {
    switch (method) {
      case DisposalMethod.previous:
        // Restore to previous
        // If we disposed every frame including first frame up to this point, then we have
        // no composited frame to restore to. In this case, restore to background instead.
        // 如果到目前为止我们处理了包括第一帧在内的每一帧，那么我们就没有要还原的合成帧。在这种情况下，请改为还原到背景。
        if (this.disposalRestoreFromIdx >= 0) {
          const data =
            this.quote.viewer.frames[this.disposalRestoreFromIdx].data
          this.quote.viewer.frame?.putImageData(data, 0, 0)
        } else {
          this.quote.viewer.restoreBackgroundColor(this.lastImg)
        }
        break
      case DisposalMethod.backgroundColor:
        // Restore to background color
        // Browser implementations historically restore to transparent; we do the same.
        // http://www.wizards-toolkit.org/discourse-server/viewtopic.php?f=1&t=21172#p86079
        this.quote.viewer.restoreBackgroundColor(this.lastImg)
        break
    }
  }
  doImg = (img: ImgBlock) => {
    this.quote.viewer.setupFrame()
    if (this.frameGroup.length > 0) {
      this.disposal(this.quote.lastDisposalMethod)
    }
    // else, Undefined/Do not dispose.
    // frame contains final pixel data from the last frame; do nothing

    //ct = color table, gct = global color table
    const ct = img.lctFlag ? img.lct : this.quote.gifData.header.gct // TODO: What if neither exists? 调用系统颜色表

    //Get existing pixels for img region after applying disposal method
    const imgData = this.quote.viewer.imgBlockToImageData({
      ct: ct as number[][],
      ...img
    })
    if (imgData) {
      this.frameGroup.push({ data: imgData, delay: this.delay || -1 })
      this.quote.viewer.putImageData(imgData, img.leftPos, img.topPos)
    }

    this.quote.viewer.initCtxScale()

    this.quote.viewer.loadingRender(!!this.quote.auto_play)

    this.lastImg = img
  }
  pushFrame() {
    this.quote.viewer.pushFrame(this.delay)
  }
}
