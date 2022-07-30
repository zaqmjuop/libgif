import { color, Frame, Header, ImgBlock, Rect } from './type'

interface ViewerQuote {
  is_vp: boolean
  vp_t: number
  vp_h: number
  vp_l: number
  vp_w: number
  c_w: number
  c_h: number 
}

export class Viewer {
  $el?: HTMLImageElement
  readonly canvas = document.createElement('canvas') // 缩放滤镜后的模样
  readonly ctx: CanvasRenderingContext2D
  readonly utilCanvas = document.createElement('canvas') // 图片文件原始模样
  readonly utilCtx: CanvasRenderingContext2D
  readonly toolbar = document.createElement('div')
  readonly quote: ViewerQuote
  opacity = 255
  zoomW = 1
  zoomH = 1
  constructor(quote: ViewerQuote) {
    this.quote = quote
    this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D
    this.utilCtx = this.utilCanvas.getContext('2d') as CanvasRenderingContext2D
  }
  get showProgressBar() {
    return this.$el?.getAttribute('progress_bar') !== 'none'
  }

  get isMounted() {
    return !!this.$el
  }

  mount(element: HTMLImageElement) {
    if (this.isMounted) {
      return
    }
    const parent = element.parentNode
    if (!parent) {
      return
    }
    this.$el = element
    const div = document.createElement('div')
    div.style.display = 'inline-block'
    const w = element.width
    this.canvas.width = w
    const h = element.height
    this.canvas.height = h

    this.toolbar.style.width = w + 'px'
    div.className = 'jsgif'
    this.toolbar.className = 'jsgif_toolbar'
    this.canvas.id = '重构'
    div.appendChild(this.canvas)
    div.appendChild(this.toolbar)
    parent.insertBefore(div, element)
    parent.removeChild(element)
  }

  onImgHeader(hdr: Header) {
    if(!this.$el){
      return
    }
    const attrWidth = this.$el.getAttribute('width')
    const width = attrWidth ? parseInt(attrWidth) : hdr.logicalScreenWidth
    const zoomW = width / hdr.logicalScreenWidth

    const attrHeight = this.$el.getAttribute('height')
    const height = attrHeight ? parseInt(attrHeight) : hdr.logicalScreenHeight
    const zoomH = height / hdr.logicalScreenHeight

    this.canvas.width = width
    this.canvas.height = height

    // setSize
    this.ctx.scale(zoomW, zoomH)
    this.zoomW = zoomW
    this.zoomH = zoomH
    this.utilCanvas.width = hdr.logicalScreenWidth
    this.utilCanvas.height = hdr.logicalScreenHeight
    this.utilCanvas.style.width = hdr.logicalScreenWidth + 'px'
    this.utilCanvas.style.height = hdr.logicalScreenHeight + 'px'
    this.utilCtx.setTransform(1, 0, 0, 1, 0, 0)
  }
  doShowProgress(percent: number) {
    if (percent > 1 || percent < 0 || !this.showProgressBar) return
    let height = 4 * this.zoomH
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

    this.ctx.fillStyle = `rgba(255,255,255,0.4)`
    this.ctx.fillRect(mid, top, width - mid, height)

    this.ctx.fillStyle = `rgba(0,123,255,0.8)`
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
  restoreBackgroundColor(e: { backgroundColor?: color } & Rect) {
    if (e.backgroundColor) {
      this.utilCtx.fillStyle = `rgb(${e.backgroundColor.join(',')} )`
      this.utilCtx.fillRect(e.leftPos, e.topPos, e.width, e.height)
    } else {
      this.utilCtx.clearRect(e.leftPos, e.topPos, e.width, e.height)
    }
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
    this.utilCanvas && this.ctx.drawImage(this.utilCanvas, 0, 0) // 真正的视图画布
  }
}
