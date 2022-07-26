import { Frame } from './type'
import { Emitter } from './Emitter'

interface PlayerQuote {
  frames: Frame[]
  gif: HTMLImageElement
  overrideLoopMode: boolean
  loopDelay: number
  auto_play: boolean | undefined
  delay: null | number
}

export class Player extends Emitter<['complete', 'putFrame', 'init']> {
  i = -1
  iterationCount = 0
  forward = true
  playing = true
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
    return (
      (this.i + delta + this.quote.frames.length) % this.quote.frames.length
    )
  }

  stepFrame(amount: number) {
    // XXX: Name is confusing.
    this.i = this.i + amount
    this.putFrame()
  }

  step() {
    let stepping = false

    const completeLoop = () => {
      this.emit('complete', this.quote.gif)
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
      let delay = this.quote.frames[this.i].delay * 10
      if (!delay) delay = 100 // FIXME: Should this even default at all? What should it be?

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

  putFrame() {
    this.i = parseInt(`${this.i}`, 10)

    if (this.i > this.quote.frames.length - 1) {
      this.i = 0
    }

    if (this.i < 0) {
      this.i = 0
    }

    this.emit('putFrame', this.i)
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
}
