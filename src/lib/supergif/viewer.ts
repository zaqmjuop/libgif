import { Stream } from './stream'
import { Frame, Header } from './type'

interface ViewerQuote {
  get_canvas_scale: () => any
  showProgressBar: boolean
  progressBarHeight: number
  progressBarBackgroundColor: string
  progressBarForegroundColor: string
  is_vp: boolean
  vp_t: number
  vp_h: number
  vp_l: number
  vp_w: number
  ctx_scaled: boolean
  c_w: number
  c_h: number
  hdr: Header
  loadError: string | null
  gif: HTMLImageElement
  frames: Frame[]
  stream: Stream
}
export class Viewer {
  readonly canvas = document.createElement('canvas')
  readonly ctx: CanvasRenderingContext2D
  readonly toolbar = document.createElement('div')
  readonly tmpCanvas = document.createElement('canvas')
  readonly quote: ViewerQuote
  initialized = false
  constructor(quote: ViewerQuote) {
    this.quote = quote
    this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D
  }
  init() {
    const parent = this.quote.gif.parentNode

    const div = document.createElement('div')

    div.setAttribute(
      'width',
      (this.canvas.width = this.quote.gif.width).toString()
    )
    div.setAttribute(
      'height',
      (this.canvas.height = this.quote.gif.height).toString()
    )
    this.toolbar.style.minWidth = this.quote.gif.width + 'px'

    div.className = 'jsgif'
    this.toolbar.className = 'jsgif_toolbar'
    div.appendChild(this.canvas)
    div.appendChild(this.toolbar)

    if (parent) {
      parent.insertBefore(div, this.quote.gif)
      parent.removeChild(this.quote.gif)
    }

    if (this.quote.c_w && this.quote.c_h)
      this.setSizes(this.quote.c_w, this.quote.c_h)
    this.initialized = true
  }
  setSizes(w: number, h: number) {
    this.canvas.width = w * this.quote.get_canvas_scale()
    this.canvas.height = h * this.quote.get_canvas_scale()
    this.toolbar.style.minWidth = w * this.quote.get_canvas_scale() + 'px'
    if (this.tmpCanvas) {
      this.tmpCanvas.width = w
      this.tmpCanvas.height = h
      this.tmpCanvas.style.width = w + 'px'
      this.tmpCanvas.style.height = h + 'px'
      this.tmpCanvas.getContext('2d')?.setTransform(1, 0, 0, 1, 0, 0)
    }
  }
  doShowProgress(pos: number, length: number, draw: boolean) {
    if (draw && this.quote.showProgressBar) {
      let height = this.quote.progressBarHeight
      let left, mid, top, width
      if (this.quote.is_vp) {
        if (!this.quote.ctx_scaled) {
          top = this.quote.vp_t + this.quote.vp_h - height
          height = height
          left = this.quote.vp_l
          mid = left + (pos / length) * this.quote.vp_w
          width = this.canvas.width
        } else {
          top =
            (this.quote.vp_t + this.quote.vp_h - height) /
            this.quote.get_canvas_scale()
          height = height / this.quote.get_canvas_scale()
          left = this.quote.vp_l / this.quote.get_canvas_scale()
          mid =
            left +
            (pos / length) * (this.quote.vp_w / this.quote.get_canvas_scale())
          width = this.canvas.width / this.quote.get_canvas_scale()
        }
        //some debugging, draw rect around viewport
        if (false) {
          // if (!ctx_scaled) {
          //   let l = this.quote.vp_l,
          //     t = this.quote.vp_t
          //   let w = this.quote.vp_w,
          //     h = this.quote.vp_h
          // } else {
          //   let l = this.quote.vp_l / get_canvas_scale(),
          //     t = this.quote.vp_t / get_canvas_scale()
          //   let w = this.quote.vp_w / get_canvas_scale(),
          //     h = this.quote.vp_h / get_canvas_scale()
          // }
          // ctx.rect(l, t, w, h)
          // ctx.stroke()
        }
      } else {
        top =
          (this.canvas.height - height) /
          (this.quote.ctx_scaled ? this.quote.get_canvas_scale() : 1)
        mid =
          ((pos / length) * this.canvas.width) /
          (this.quote.ctx_scaled ? this.quote.get_canvas_scale() : 1)
        width =
          this.canvas.width /
          (this.quote.ctx_scaled ? this.quote.get_canvas_scale() : 1)
        height /= this.quote.ctx_scaled ? this.quote.get_canvas_scale() : 1
      }

      this.ctx.fillStyle =
        this.quote.progressBarBackgroundColor || this.ctx.fillStyle
      this.ctx.fillRect(mid, top, width - mid, height)

      this.ctx.fillStyle =
        this.quote.progressBarForegroundColor || this.ctx.fillStyle
      this.ctx.fillRect(0, top, mid, height)
    }
  }
  doLoadError(originOfError: string) {
    const drawError = () => {
      this.ctx.fillStyle = 'black'
      this.ctx.fillRect(
        0,
        0,
        this.quote.c_w ? this.quote.c_w : this.quote.hdr.width,
        this.quote.c_h ? this.quote.c_h : this.quote.hdr.height
      )
      this.ctx.strokeStyle = 'red'
      this.ctx.lineWidth = 3
      this.ctx.moveTo(0, 0)
      this.ctx.lineTo(
        this.quote.c_w ? this.quote.c_w : this.quote.hdr.width,
        this.quote.c_h ? this.quote.c_h : this.quote.hdr.height
      )
      this.ctx.moveTo(
        0,
        this.quote.c_h ? this.quote.c_h : this.quote.hdr.height
      )
      this.ctx.lineTo(this.quote.c_w ? this.quote.c_w : this.quote.hdr.width, 0)
      this.ctx.stroke()
    }

    this.quote.loadError = originOfError
    this.quote.hdr = {
      width: this.quote.gif.width,
      height: this.quote.gif.height
    } as Header // Fake header.
    this.quote.frames = []
    drawError()
  }
  doDecodeProgress(draw: boolean) {
    this.doShowProgress(
      this.quote.stream.pos,
      this.quote.stream.data.length,
      draw
    )
  }
  /**
   * @param{boolean=} draw Whether to draw progress bar or not; this is not idempotent because of translucency.
   *                       Note that this means that the text will be unsynchronized with the progress bar on non-frames;
   *                       but those are typically so small (GCE etc.) that it doesn't really matter. TODO: Do this properly.
   */
  withProgress(fn: Function, draw = false) {
    return (block) => {
      fn(block)
      this.doDecodeProgress(draw)
    }
  }
}
