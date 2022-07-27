import { Frame, Gif89aData, ImgBlock, Rect } from './type'
import { Emitter } from './Emitter'
import { Viewer } from './viewer'

interface PlayerQuote {
  overrideLoopMode: boolean
  gifData: Gif89aData
  lastDisposalMethod: number | null
  disposalRestoreFromIdx: number | null
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
  frames: Frame[] = []
  lastImg?: Rect & Partial<ImgBlock>
  readonly quote: PlayerQuote

  constructor(quote: PlayerQuote) {
    super()
    this.quote = quote
  }

  /**
   * Gets the index of the frame "up next".
   * @returns {number}
   */
  getNextFrameNo() {
    const delta = this.forward ? 1 : -1
    return (this.i + delta + this.frames.length) % this.frames.length
  }

  step() {
    let stepping = false

    const completeLoop = () => {
      this.emit('complete')
      this.iterationCount++

      if (this.quote.overrideLoopMode || this.iterationCount < 0) {
        doStep()
      } else {
        stepping = false
        this.playing = false
      }
    }

    const doStep = () => {
      stepping = this.playing
      if (!stepping) return

      this.stepFrame(1)
      let delay = (this.delay || 1.666) * 10

      const nextFrameNo = this.getNextFrameNo()
      if (nextFrameNo === 0) {
        delay += this.quote.loopDelay
        setTimeout(completeLoop, delay)
      } else {
        setTimeout(doStep, delay)
      }
    }

    return !stepping && setTimeout(doStep, 0)
  }

  stepFrame(amount: number) {
    // XXX: Name is confusing.
    this.i = this.i + amount
    this.putFrame()
  }

  putFrame() {
    if (this.i < 0 || this.i > this.frames.length - 1) {
      this.i = 0
    }
    const flag = this.i
    const data = this.frames[flag].data
    this.emit('putFrame', { flag, data })
  }

  play() {
    this.playing = true
    this.step()
  }

  pause() {
    this.playing = false
  }
  init() {
    this.emit('init')

    if (this.quote.auto_play) {
      this.step()
    } else {
      this.i = 0
      this.putFrame()
    }
  }

  get move_relative() {
    return this.stepFrame
  }
  current_frame() {
    return this.i
  }
  move_to(frame_idx) {
    this.i = frame_idx
    this.putFrame()
  }
  doImg = (img: ImgBlock) => {
    if (!this.quote.viewer.frame && this.quote.viewer.tmpCanvas) {
      this.quote.viewer.frame = this.quote.viewer.tmpCanvas.getContext('2d')
    }
    if (this.frames.length > 0) {
      if (this.quote.lastDisposalMethod === DisposalMethod.previous) {
        // Restore to previous
        // If we disposed every frame including first frame up to this point, then we have
        // no composited frame to restore to. In this case, restore to background instead.
        if (this.quote.disposalRestoreFromIdx !== null) {
          const data = this.frames[this.quote.disposalRestoreFromIdx].data
          this.quote.viewer.frame?.putImageData(data, 0, 0)
        } else {
          this.quote.viewer.restoreBackgroundColor(this.lastImg)
        }
      } else {
        this.quote.disposalRestoreFromIdx = this.frames.length - 1
      }

      if (this.quote.lastDisposalMethod === 2) {
        // Restore to background color
        // Browser implementations historically restore to transparent; we do the same.
        // http://www.wizards-toolkit.org/discourse-server/viewtopic.php?f=1&t=21172#p86079
        this.quote.viewer.restoreBackgroundColor(this.lastImg)
      }
    }
    // else, Undefined/Do not dispose.
    // frame contains final pixel data from the last frame; do nothing

    //ct = color table, gct = global color table
    const ct = img.lctFlag ? img.lct : this.quote.gifData.header.gct // TODO: What if neither exists?

    //Get existing pixels for img region after applying disposal method
    if (this.quote.viewer.frame) {
      const imgData = this.quote.viewer.frame.getImageData(
        img.leftPos,
        img.topPos,
        img.width,
        img.height
      ) //apply color table colors
      img.pixels.forEach((pixel, i) => {
        // imgData.data === [R,G,B,A,R,G,B,A,...]
        if (pixel !== this.quote.viewer.quote.transparency && ct) {
          imgData.data[i * 4 + 0] = ct[pixel][0]
          imgData.data[i * 4 + 1] = ct[pixel][1]
          imgData.data[i * 4 + 2] = ct[pixel][2]
          imgData.data[i * 4 + 3] = this.quote.viewer.opacity // Opaque.
        }
      })

      this.quote.viewer.frame?.putImageData(imgData, img.leftPos, img.topPos)
    }

    if (!this.quote.viewer.ctx_scaled) {
      const scale = this.quote.viewer.quote.get_canvas_scale()
      this.quote.viewer.ctx.scale(scale, scale)
      this.quote.viewer.ctx_scaled = true
    }

    // We could use the on-page canvas directly, except that we draw a progress
    // bar for each image chunk (not just the final image).
    if (this.quote.viewer.drawWhileLoading) {
      this.quote.viewer.tmpCanvas &&
        this.quote.viewer.ctx.drawImage(this.quote.viewer.tmpCanvas, 0, 0)
      this.quote.viewer.drawWhileLoading = !!this.quote.auto_play
    }

    this.lastImg = img
  }
  pushFrame() {
    if (!this.quote.viewer.frame) return
    this.frames.push({
      data: this.quote.viewer.frame.getImageData(
        0,
        0,
        this.quote.gifData.header.width,
        this.quote.gifData.header.height
      ),
      delay: this.delay || -1
    })
    this.quote.viewer.frameOffsets.push({ x: 0, y: 0 })
  }
}
