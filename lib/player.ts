import { DecodedStore } from './store/decoded'
import { DecodedData, frame, Frame, Header, Rect } from './type'
import { Emitter } from './utils/Emitter'
import { Viewer } from './viewer'

interface PlayerQuote {
  viewer: Viewer
}

type playerHeader = { width: number; height: number }

export class Player extends Emitter<['play', 'frameChange', 'pause']> {
  private i = 0
  loopCount = 0
  forward = true
  playing = false
  opacity = 255
  onFramed = false
  t = 0
  currentKey?: string = void 0
  prepared = false
  readonly quote: PlayerQuote

  constructor(quote: PlayerQuote) {
    super()
    this.quote = quote
  }

  get currentImg() {
    return (
      (this.currentKey && DecodedStore.getDecodeData(this.currentKey)) || void 0
    )
  }

  get header(): playerHeader | void {
    const img = this.currentImg
    if (!img?.header) {
      return void 0
    }
    return {
      width: img.header.logicalScreenWidth,
      height: img.header.logicalScreenHeight
    }
  }

  get framsComplete() {
    return !!this.currentImg?.complete
  }

  get frameGroup() {
    return this.currentImg ? this.currentImg.frames : []
  }

  get readyStatus() {
    return this.currentKey
      ? DecodedStore.getDecodeStatus(this.currentKey)
      : 'none'
  }

  get currentFrame(): frame | void {
    return this.frameGroup[this.i]
  }

  get currentFrameNo() {
    return this.i
  }

  /**
   * Gets the index of the frame "up next".
   * @returns {number}
   */
  private getNextFrameNo() {
    const length = this.frameGroup.length
    if (!length) {
      return length
    }
    const delta = this.forward ? 1 : -1
    const res = (this.i + delta + length) % length
    return res
  }

  private finish = () => {
    this.loopCount++
    if (this.quote.viewer.canvas?.getAttribute('loop') === 'loop') {
      this.goOn()
    } else {
      this.pause()
    }
  }

  private goOn = () => {
    if (!this.playing) return
    clearTimeout(this.t)
    const currentFrame = this.putFrame(this.getNextFrameNo())
    const isComplete = this.getNextFrameNo() === 0 && this.framsComplete
    const delay = currentFrame?.delay || 17
    this.t = window.setTimeout(isComplete ? this.finish : this.goOn, delay)
  }

  putFrame(flag: number) {
    const frame = this.frameGroup[flag]
    if (frame) {
      this.i = flag
      this.quote.viewer.putDraft(frame.data, frame.leftPos, frame.topPos)
      this.quote.viewer.drawDraft()
      this.emit('frameChange')
    }
    return frame
  }

  play = () => {
    if (this.playing) {
      return
    }
    this.playing = true
    this.goOn()
    this.emit('play')
  }

  pause = () => {
    this.playing = false
    this.emit('pause')
  }

  resetState = () => {
    clearTimeout(this.t)
    this.i = 0
    this.loopCount = 0
    this.forward = true
    this.playing = false
    this.opacity = 255
    this.onFramed = false
    this.prepared = false
  }

  async prepare() {
    const setHeader = () => {
      const header = this.header
      if (header) {
        this.quote.viewer.setDraftSize(header)
      }
      return !!header
    }
    if (!setHeader()) {
      await new Promise((resolve) => {
        const handler = () =>
          setHeader() && resolve(DecodedStore.off('header', handler))
        DecodedStore.on('header', handler)
      })
    }
    this.prepared = true
  }

  async switch(key: string) {
    this.resetState()
    this.currentKey = key
    await this.prepare()
    this.play()
  }

  onError = () => {
    this.resetState()
  }
}
