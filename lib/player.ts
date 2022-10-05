import { DecodedStore } from './store/decoded'
import { frame } from './type'
import { Emitter } from './utils/Emitter'
import { Viewer } from './viewer'

interface PlayerQuote {
  viewer: Viewer
}

type playerHeader = { width: number; height: number }

export class Player extends Emitter<['play', 'frameChange', 'pause', 'playended']> {
  private i = 0
  private _speed = 1
  private _forward = true
  loopCount = 0
  playing = false
  t = 0
  currentKey?: string = void 0
  prepared = false

  readonly quote: PlayerQuote

  constructor(quote: PlayerQuote) {
    super()
    this.quote = quote
  }

  get rate() {
    return this._speed
  }

  set rate(val: number) {
    if (val >= 0) {
      this._speed = val
    }
  }

  get forward() {
    return this._forward
  }

  set forward(val: boolean) {
    this._forward = val
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
    if (this.quote.viewer.canvas?.getAttribute('loop') !== 'loop') {
      this.goOn()
    } else {
      this.pause()
      this.emit('playended')
    }
  }

  private goOn = () => {
    if (!this.playing) return
    clearTimeout(this.t)
    const currentFrame = this.putFrame(this.getNextFrameNo())
    const isComplete = this.getNextFrameNo() === 0 && this.framsComplete
    const delay = currentFrame?.delay || 17
    this.t = window.setTimeout(
      isComplete ? this.finish : this.goOn,
      delay / this.rate
    )
  }

  putFrame(flag: number) {
    const frame = this.frameGroup[flag]
    if (frame && frame.data !== this.quote.viewer.currentImgData) {
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
    this.prepared = false
    this.rate = 1
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
