import { rgb } from './type'

import { Emitter } from './utils/Emitter'
export class Viewer extends Emitter<[]> {
  canvas?: HTMLCanvasElement // 缩放滤镜后的模样
  ctx?: CanvasRenderingContext2D
  readonly resizeObserver: ResizeObserver
  readonly draftCanvas = document.createElement('canvas') // 图片文件原始模样
  readonly draftCtx: CanvasRenderingContext2D
  currentImgData: ImageData | rgb | null = null
  constructor() {
    super()
    this.resizeObserver = new ResizeObserver(this.onResize.bind(this))
    this.draftCtx = this.draftCanvas.getContext(
      '2d'
    ) as CanvasRenderingContext2D
  }

  get scale() {
    const canvasWidth = this.canvas?.width || 0
    const draftWidth = this.draftCanvas.width
    const canvasHeight = this.canvas?.height || 0
    const draftHeight = this.draftCanvas.height
    return {
      zoomW: canvasWidth / draftWidth,
      zoomH: canvasHeight / draftHeight
    }
  }

  updateScale() {
    this.ctx?.setTransform(1, 0, 0, 1, 0, 0)
    const { zoomW, zoomH } = this.scale
    this.ctx?.scale(zoomW, zoomH)
  }

  private onResize() {
    if (!this.canvas || !this.ctx) {
      return
    }
    this.updateScale()
    this.drawDraft()
  }

  mount(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D
    this.resizeObserver.observe(canvas)
  }

  setDraftSize(imgSize: { width: number; height: number }) {
    if (!this.canvas) {
      return
    }
    // setSize
    this.draftCanvas.width = imgSize.width
    this.draftCanvas.height = imgSize.height
    this.draftCanvas.style.width = imgSize.width + 'px'
    this.draftCanvas.style.height = imgSize.height + 'px'
    this.draftCtx.setTransform(1, 0, 0, 1, 0, 0)
    this.updateScale()
  }
  drawError = (originOfError: string) => {
    if (!this.canvas || !this.ctx) {
      return
    }
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

  putDraft(picture: ImageData | rgb | null, left: number = 0, top: number = 0) {
    const { width, height } = this.draftCanvas
    this.currentImgData = picture
    if (!picture) {
      this.draftCtx.clearRect(0, 0, width, height)
    } else if (picture instanceof ImageData) {
      this.draftCtx.putImageData(picture, left, top, 0, 0, width, height)
    } else {
      this.draftCtx.fillStyle = `rgb(${picture.join(',')} )`
      this.draftCtx.fillRect(0, 0, width, height)
    }
  }
  drawDraft() {
    this.ctx?.drawImage(this.draftCanvas, 0, 0) // 真正的视图画布
  }
}
