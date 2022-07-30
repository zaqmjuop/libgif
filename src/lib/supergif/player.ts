import {
  background,
  color,
  Frame,
  GCExtBlock,
  Gif89aData,
  Header,
  ImgBlock,
  Rect
} from './type'
import { Emitter } from './Emitter'
import { Viewer } from './viewer'

interface PlayerQuote {
  overrideLoopMode: boolean
  gifData: Gif89aData
  loopDelay: number
  viewer: Viewer
}
// Disposal method indicates the way in which the graphic is to be treated after being displayed.
enum DisposalMethod {
  ignore = 0, // No disposal specified. The decoder is not required to take any action.
  skip = 1, // Do not dispose. The graphic is to be left in place.
  backgroundColor = 2, //  Restore to background color. The area used by the graphic must be restored to the background color.
  previous = 3 // Restore to previous. The decoder is required to restore the area overwritten by the graphic with what was there prior to rendering the graphic.
} // Importantly, "previous" means the frame state after the last disposal of method 0, 1, or 2.

export class Player extends Emitter<['complete']> {
  private i = -1
  iterationCount = 0
  forward = true
  playing = true
  delay: null | number = null

  lastImg?: Rect & Partial<ImgBlock>
  frameGroup: Array<Frame & Rect> = []
  currentGce?: GCExtBlock
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
    this.quote.viewer.onPutFrame({ flag: this.i, ...frame })
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

  onGCE(gce: GCExtBlock) {
    this.currentGce = gce
  }

  doImg = (img: ImgBlock) => {
    // gce
    const gce = this.currentGce
    if (gce) {
      this.disposal(gce.disposalMethod)
    }
    const transparency =
      gce && gce.transparencyGiven ? gce.transparencyIndex : null
    const delayTime = (gce && gce.delayTime) || 100 // 如果没有gce那么默认帧间隔是100ms
    // img
    const colorTable = img.lctFlag
      ? img.lct
      : this.quote.gifData.header.globalColorTable // TODO: What if neither exists? 调用系统颜色表
    //Get existing pixels for img region after applying disposal method
    const imgData = this.quote.viewer.imgBlockToImageData({
      ct: colorTable as color[],
      transparency,
      ...img
    })
    const hdr = this.quote.gifData.header
    const frame: Frame & Rect = {
      data: imgData,
      delay: delayTime,
      leftPos: img.leftPos,
      topPos: img.topPos,
      width: hdr.logicalScreenWidth,
      height: hdr.logicalScreenHeight
    }
    this.frameGroup.push(frame)

    if (imgData) {
      // 绘制当前帧
      this.quote.viewer.putImageData(frame.data, frame.leftPos, frame.topPos)
    }

    this.quote.viewer.loadingRender()
    this.currentGce = void 0
  }
  disposal(method: number | null) {
    switch (method) {
      case DisposalMethod.previous:
        this.restorePrevious()
        break
      case DisposalMethod.backgroundColor:
        this.restoreBackgroundColor()
        break
    }
  }
  restorePrevious() {
    const prevFrame = this.frameGroup[this.frameGroup.length - 1]
    if (prevFrame) {
      this.quote.viewer.utilCtx.putImageData(prevFrame.data, 0, 0)
    } else {
      this.restoreBackgroundColor()
    }
  }
  restoreBackgroundColor() {
    const hdr = this.quote.gifData.header
    this.quote.viewer.restoreBackgroundColor({
      backgroundColor: hdr.backgroundColor || undefined,
      leftPos: 0,
      topPos: 0,
      width: hdr.logicalScreenWidth,
      height: hdr.logicalScreenHeight
    })
  }
}
