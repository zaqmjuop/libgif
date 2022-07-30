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

  get disposalRestoreFromIdx() {
    return this.frameGroup.length - 1
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
    this.pushFrame()
  }

  doImg = (img: ImgBlock) => {
    // gce
    const gce = this.currentGce
    if (gce) {
      this.disposal(gce.disposalMethod)
    }
    const transparency =
      gce && gce.transparencyGiven ? gce.transparencyIndex : null
    const delayTime = (gce && gce.delayTime) || 10
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

    if (imgData) {
      // 绘制当前帧
      this.quote.viewer.putImageData(imgData, img.leftPos, img.topPos)
    }

    this.quote.viewer.loadingRender()
    this.currentGce = void 0
  }
  disposal(method: number | null) {
    switch (method) {
      case DisposalMethod.previous:
        // Restore to previous
        // If we disposed every frame including first frame up to this point, then we have
        // no composited frame to restore to. In this case, restore to background instead.
        // 如果到目前为止我们处理了包括第一帧在内的每一帧，那么我们就没有要还原的合成帧。在这种情况下，请改为还原到背景。
        if (this.disposalRestoreFromIdx >= 0) {
          const data = this.frameGroup[this.disposalRestoreFromIdx].data
          this.quote.viewer.utilCtx.putImageData(data, 0, 0)
        } else {
          this.restoreBackgroundColor()
        }
        break
      case DisposalMethod.backgroundColor:
        this.restoreBackgroundColor()
        break
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

  pushFrame() {
    const gce = this.quote.gifData.gces[this.quote.gifData.gces.length - 1]
    if (gce) {
      this.delay = gce.delayTime
    }

    const width = this.quote.viewer.utilCanvas.width
    const height = this.quote.viewer.utilCanvas.width

    if (this.quote.gifData.imgs.length) {
      // 保存上一帧
      this.frameGroup.push({
        width,
        height,
        leftPos: 0,
        topPos: 0,
        data: this.quote.viewer.utilCtx.getImageData(0, 0, width, height),
        delay: this.delay || -1
      })
    }
  }
}
