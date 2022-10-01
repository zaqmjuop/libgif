import { Rect, rgb } from './type'

import { Emitter } from './utils/Emitter'
export class Viewer extends Emitter<['resize']> {
  canvas?: HTMLCanvasElement // 缩放滤镜后的模样
  ctx?: CanvasRenderingContext2D
  readonly resizeObserver: ResizeObserver
  readonly draftCanvas = document.createElement('canvas') // 图片文件原始模样
  readonly draftCtx: CanvasRenderingContext2D
  opacity = 255
  prevZoomW = 1
  prevZoomH = 1
  constructor() {
    super()
    this.resizeObserver = new ResizeObserver(this.onResize.bind(this))
    this.draftCtx = this.draftCanvas.getContext(
      '2d'
    ) as CanvasRenderingContext2D
  }
  get showProgressBar() {
    return this.canvas?.getAttribute('progress_bar') !== 'none'
  }

  get zoomW() {
    const canvasWidth = this.canvas?.width || 0
    const draftWidth = this.draftCanvas.width
    return canvasWidth / draftWidth
  }

  get zoomH() {
    const canvasHeight = this.canvas?.height || 0
    const draftHeight = this.draftCanvas.height
    return canvasHeight / draftHeight
  }

  private updateZoomW() {
    const canvasWidth = this.canvas?.width || 0
    const draftWidth = this.draftCanvas.width
    this.prevZoomW = canvasWidth / draftWidth
    return this.prevZoomW
  }

  private updateZoomH() {
    const canvasWidth = this.canvas?.width || 0
    const draftWidth = this.draftCanvas.width
    this.prevZoomH = canvasWidth / draftWidth
    return this.prevZoomH
  }

  // private resetCanvasScale() {
  //   if (!this.canvas) {
  //     return
  //   }
  //   this.ctx?.setTransform(1, 0, 0, 1, 0, 0)
  //   this.ctx?.scale(this.zoomW, this.zoomH)
  // }

  private onResize() {
    if (!this.canvas || !this.ctx) {
      return
    }
    const prevData2 = this.ctx.getImageData(
      0,
      0,
      this.canvas.width,
      this.canvas.height
    )
     this.ctx?.setTransform(1, 0, 0, 1, 0, 0)
    this.ctx?.scale(this.updateZoomW(), this.updateZoomH())
    const prevData = this.draftCtx.getImageData(
      0,
      0,
      this.draftCanvas.width,
      this.draftCanvas.height
    )
    this.ctx?.putImageData(prevData2, 0, 0)
    this.ctx?.putImageData(prevData, 0, 0)

    this.emit('resize')
  }

  private getDraft(rect: Rect) {
    return this.draftCtx.getImageData(
      rect.leftPos,
      rect.topPos,
      rect.width,
      rect.height
    )
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
    this.ctx?.setTransform(1, 0, 0, 1, 0, 0)
    this.ctx?.scale(this.updateZoomW(), this.updateZoomH())
  }
  drawProgress(percent: number) {
    if (!this.canvas) {
      return
    }
    if (percent > 1 || percent < 0 || !this.showProgressBar) return

    let height = 1
    const top = (this.canvas.height - height) / this.zoomH
    const mid = (percent * this.canvas.width) / this.zoomW

    height = height / this.zoomH
    const width = this.canvas.width / this.zoomW
    if (!this.ctx) {
      return
    }
    this.ctx.fillStyle = `rgba(255,255,255,0.4)`
    this.ctx.fillRect(mid, top, width - mid, height)

    this.ctx.fillStyle = `rgba(0,123,255,0.4)`
    this.ctx.fillRect(0, top, mid, height)
  }
  drawError = (originOfError: string) => {
    if (!this.canvas || !this.ctx) {
      return
    }
    console.error(originOfError)
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
    if (!this.canvas || !this.ctx) {
      return
    }
    const { width, height } = this.canvas
    this.ctx?.drawImage(this.draftCanvas, 0, 0) // 真正的视图画布
  }
}
