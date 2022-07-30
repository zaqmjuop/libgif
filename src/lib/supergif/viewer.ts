import { Frame, Hander, Header, ImgBlock, Offset, Rect } from './type'

interface ViewerQuote {
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
  readonly canvas = document.createElement('canvas') // 缩放滤镜后的模样

  readonly ctx: CanvasRenderingContext2D
  readonly utilCanvas = document.createElement('canvas') // 图片文件原始模样
  readonly utilCtx: CanvasRenderingContext2D
  readonly toolbar = document.createElement('div')
  readonly quote: ViewerQuote
  drawWhileLoading: boolean
  opacity = 255
  zoomW = 1
  zoomH = 1
  constructor(quote: ViewerQuote) {
    this.quote = quote
    this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D
    this.utilCtx = this.utilCanvas.getContext('2d') as CanvasRenderingContext2D
    this.drawWhileLoading = quote.drawWhileLoading
  }
  get showProgressBar() {
    return this.drawWhileLoading && this.quote.showProgressBar
  }

  onImgHeader(hdr: Header) {
    const parent = this.quote.gif.parentNode

    if (parent) {
      // init
      const div = document.createElement('div')
      let w = 0
      let zoomW = 1
      const domWidth = this.quote.gif.getAttribute('width')
      if (domWidth) {
        w = parseInt(domWidth)
        zoomW = w / hdr.logicalScreenWidth
      } else {
        w = hdr.logicalScreenWidth
        zoomW = 1
      }
      this.canvas.width = w
      div.setAttribute('width', w.toString())
      let h = 0
      let zoomH = 1
      const domHeight = this.quote.gif.getAttribute('height')
      if (domHeight) {
        h = parseInt(domHeight)
        zoomH = h / hdr.logicalScreenHeight
      } else {
        h = hdr.logicalScreenHeight
        zoomH = 1
      }
      this.canvas.height = h
      div.setAttribute('height', h.toString())
      this.toolbar.style.width = w + 'px'
      div.className = 'jsgif'
      this.toolbar.className = 'jsgif_toolbar'
      this.canvas.id = '重构'
      div.appendChild(this.canvas)
      div.appendChild(this.toolbar)
      parent.insertBefore(div, this.quote.gif)
      parent.removeChild(this.quote.gif)
      // setSize
      this.ctx.scale(zoomW, zoomH)
      this.zoomW = zoomW
      this.zoomH = zoomH
      this.utilCanvas.width = hdr.logicalScreenWidth
      this.utilCanvas.height = hdr.logicalScreenHeight
      this.utilCanvas.style.width = hdr.logicalScreenWidth + 'px'
      this.utilCanvas.style.height = hdr.logicalScreenHeight + 'px'
      this.utilCanvas.getContext('2d')?.setTransform(1, 0, 0, 1, 0, 0)
    }
  }
  doShowProgress(percent: number) {
    if (percent > 1 || percent < 0 || !this.showProgressBar) return
    let height = this.quote.progressBarHeight * this.zoomH
    let mid, top, width
    const scale = this.zoomW
    if (this.quote.is_vp) {
      top = (this.quote.vp_t + this.quote.vp_h - height) / scale
      mid = this.quote.vp_l / scale + percent * (this.quote.vp_w / scale)
    } else {
      top = (this.canvas.height - height) / scale
      mid = (percent * this.canvas.width) / scale
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
  restoreBackgroundColor(rect: Rect) {
    this.utilCtx.clearRect(rect.leftPos, rect.topPos, rect.width, rect.height)
  }
  imgBlockToImageData = (
    img: ImgBlock & { ct: number[][]; transparency: number | null }
  ) => {
    const imgData = this.utilCtx.getImageData(
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

  onPutFrame = (e: { flag: number } & Frame & Rect) => {
    const data = e.data
    this.utilCtx.putImageData(data, e.leftPos, e.topPos)
    this.ctx.globalCompositeOperation = 'copy'
    this.ctx.drawImage(this.utilCanvas, 0, 0)
  }
  putImageData = (data: ImageData, left: number, top: number) => {
    this.utilCtx.putImageData(data, left, top)
  }
  loadingRender() {
    // We could use the on-page canvas directly, except that we draw a progress
    // bar for each image chunk (not just the final image).
    if (this.drawWhileLoading) {
      this.utilCanvas && this.ctx.drawImage(this.utilCanvas, 0, 0) // 真正的视图画布
    }
  }
}
