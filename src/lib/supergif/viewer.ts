import { Frame, Hander, Header, ImgBlock, Offset, Rect } from './type'

interface ViewerQuote {
  get_canvas_scale: () => number
  showProgressBar: boolean
  progressBarHeight: number
  progressBarBackgroundColor: string
  progressBarForegroundColor: string
  is_vp: boolean
  vp_t: number
  vp_h: number
  vp_l: number
  vp_w: number
  c_w: number
  c_h: number
  gif: HTMLImageElement
  drawWhileLoading: boolean
}

export class Viewer {
  readonly canvas = document.createElement('canvas')
  readonly ctx: CanvasRenderingContext2D
  readonly toolbar = document.createElement('div')
  readonly tmpCanvas = document.createElement('canvas')
  readonly quote: ViewerQuote
  initialized = false
  ctx_scaled = false
  drawWhileLoading: boolean
  frame: CanvasRenderingContext2D | null = null
  opacity = 255
  frames: Frame[] = []
  public frameOffsets: Offset[] = []
  constructor(quote: ViewerQuote) {
    this.quote = quote
    this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D
    this.drawWhileLoading = quote.drawWhileLoading
  }
  get showProgressBar() {
    return this.drawWhileLoading && this.quote.showProgressBar
  }
  init() {
    const parent = this.quote.gif.parentNode
    this.canvas.id = '重构'

    if (parent) {
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
      parent.insertBefore(div, this.quote.gif)
      parent.removeChild(this.quote.gif)
    }

    this.setSizes()
    this.initialized = true
  }
  setSizes() {
    const w = this.quote.c_w
    const h = this.quote.c_h
    const scale = this.quote.get_canvas_scale()
    this.canvas.width = w * scale
    this.canvas.height = h * scale
    this.toolbar.style.minWidth = w * scale + 'px'
    this.tmpCanvas.width = w
    this.tmpCanvas.height = h
    this.tmpCanvas.style.width = w + 'px'
    this.tmpCanvas.style.height = h + 'px'
    this.tmpCanvas.getContext('2d')?.setTransform(1, 0, 0, 1, 0, 0)
  }
  resize = () => {
    if (!(this.quote.c_w && this.quote.c_h)) {
      const zoom = this.quote.get_canvas_scale()
      this.ctx.scale(zoom, zoom)
    }
  }
  doShowProgress(pos: number, length: number, draw: boolean) {
    if (!draw || !this.showProgressBar) return
    let height = this.quote.progressBarHeight
    let mid, top, width
    const scale = this.ctx_scaled ? this.quote.get_canvas_scale() : 1
    if (this.quote.is_vp) {
      top = (this.quote.vp_t + this.quote.vp_h - height) / scale
      mid = this.quote.vp_l / scale + (pos / length) * (this.quote.vp_w / scale)
    } else {
      top = (this.canvas.height - height) / scale
      mid = ((pos / length) * this.canvas.width) / scale
    }
    height = height / scale
    width = this.canvas.width / scale

    this.ctx.fillStyle =
      this.quote.progressBarBackgroundColor || this.ctx.fillStyle
    this.ctx.fillRect(mid, top, width - mid, height)

    this.ctx.fillStyle =
      this.quote.progressBarForegroundColor || this.ctx.fillStyle
    this.ctx.fillRect(0, top, mid, height)
  }
  doLoadError = (originOfError: string) => {
    this.ctx.fillStyle = 'black'
    const w = this.canvas.width
    const h = this.canvas.height
    this.ctx.fillRect(0, 0, w, h)
    this.ctx.strokeStyle = 'red'
    this.ctx.lineWidth = 3
    this.ctx.moveTo(0, 0)
    this.ctx.lineTo(w, h)
    this.ctx.moveTo(0, h)
    this.ctx.lineTo(w, 0)
    this.ctx.stroke()
  }
  doDecodeProgress(pos: number, length: number, draw: boolean) {
    this.doShowProgress(pos, length, draw)
  }
  restoreBackgroundColor(lastImg?: Rect & Partial<ImgBlock>) {
    lastImg &&
      this.frame?.clearRect(
        lastImg.leftPos,
        lastImg.topPos,
        lastImg.width,
        lastImg.height
      )
  }
  setFrameOffset = (flag: number, offset: Offset) => {
    if (!this.frameOffsets[flag]) {
      this.frameOffsets[flag] = offset
      return
    }
    if (typeof offset.x !== 'undefined') {
      this.frameOffsets[flag].x = offset.x
    }
    if (typeof offset.y !== 'undefined') {
      this.frameOffsets[flag].y = offset.y
    }
  }
  onPutFrame = (e: { flag: number; data: ImageData }) => {
    if (this.tmpCanvas) {
      const offset = this.frameOffsets[e.flag]
      const data = e.data

      this.tmpCanvas.getContext('2d')?.putImageData(data, offset.x, offset.y)
    }
    this.ctx.globalCompositeOperation = 'copy'
    this.ctx.drawImage(this.tmpCanvas, 0, 0)
  }
  pushFrame(delay: number | null) {
    if (!this.frame) return
    this.frames.push({
      data: this.frame.getImageData(
        0,
        0,
        this.canvas.width,
        this.canvas.height
      ),
      delay: delay || -1
    })
    this.frameOffsets.push({ x: 0, y: 0 })
  }
  imgBlockToImageData = (
    img: ImgBlock & { ct: number[][]; transparency: number | null }
  ) => {
    if (this.frame) {
      const imgData = this.frame.getImageData(
        img.leftPos,
        img.topPos,
        img.width,
        img.height
      ) //apply color table colors
      img.pixels.forEach((pixel, i) => {
        // imgData.data === [R,G,B,A,R,G,B,A,...]
        if (pixel !== img.transparency && img.ct) {
          imgData.data[i * 4 + 0] = img.ct[pixel][0]
          imgData.data[i * 4 + 1] = img.ct[pixel][1]
          imgData.data[i * 4 + 2] = img.ct[pixel][2]
          imgData.data[i * 4 + 3] = this.opacity // Opaque.
        }
      })
      return imgData
    }
  }
  putImageData = (data: ImageData, left: number, top: number) => {
    this.frame?.putImageData(data, left, top)
  }
  setupFrame() {
    this.frame = this.tmpCanvas.getContext('2d')
  }
  initCtxScale() {
    if (!this.ctx_scaled) {
      const scale = this.quote.get_canvas_scale()
      this.ctx.scale(scale, scale)
      this.ctx_scaled = true
    }
  }

  loadingRender(auto_play: boolean) {
    // We could use the on-page canvas directly, except that we draw a progress
    // bar for each image chunk (not just the final image).
    if (this.drawWhileLoading) {
      this.tmpCanvas && this.ctx.drawImage(this.tmpCanvas, 0, 0)
      this.drawWhileLoading = auto_play
    }
  }
}
