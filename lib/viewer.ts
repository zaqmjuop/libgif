import { Rect, rgb } from './type'
export class Viewer {
  $el?: HTMLElement
  readonly canvas = document.createElement('canvas') // 缩放滤镜后的模样
  readonly ctx: CanvasRenderingContext2D
  readonly draftCanvas = document.createElement('canvas') // 图片文件原始模样
  readonly draftCtx: CanvasRenderingContext2D
  opacity = 255
  zoomW = 1
  zoomH = 1
  constructor() {
    this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D
    this.draftCtx = this.draftCanvas.getContext('2d') as CanvasRenderingContext2D
  }
  get showProgressBar() {
    return this.$el?.getAttribute('progress_bar') !== 'none'
  }

  get isMounted() {
    return !!this.canvas.parentNode?.parentNode
  }

  mount(element: HTMLElement) {
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

    const w = Number(element.getAttribute('width')) || 0
    const h = Number(element.getAttribute('height')) || 0
    this.canvas.id = '重构'
    this.canvas.style.display = 'block'
    this.canvas.width = w
    this.canvas.height = h

    div.appendChild(this.canvas)
    parent.insertBefore(div, element)
    parent.removeChild(element)
  }

  adapt(imgSize: { width: number; height: number }) {
    if (!this.$el) {
      return
    }
    const attrWidth = this.$el.getAttribute('width')
    const width = attrWidth ? parseInt(attrWidth) : imgSize.width
    const zoomW = width / imgSize.width

    const attrHeight = this.$el.getAttribute('height')
    const height = attrHeight ? parseInt(attrHeight) : imgSize.height
    const zoomH = height / imgSize.height

    this.canvas.width = width
    this.canvas.height = height

    // setSize
    this.ctx.scale(zoomW, zoomH)
    this.zoomW = zoomW
    this.zoomH = zoomH
    this.draftCanvas.width = imgSize.width
    this.draftCanvas.height = imgSize.height
    this.draftCanvas.style.width = imgSize.width + 'px'
    this.draftCanvas.style.height = imgSize.height + 'px'
    this.draftCtx.setTransform(1, 0, 0, 1, 0, 0)
  }
  drawProgress(percent: number) {
    if (percent > 1 || percent < 0 || !this.showProgressBar) return

    let height = 1
    const top = (this.canvas.height - height) / this.zoomH
    const mid = (percent * this.canvas.width) / this.zoomW

    height = height / this.zoomH
    const width = this.canvas.width / this.zoomW

    this.ctx.fillStyle = `rgba(255,255,255,0.4)`
    this.ctx.fillRect(mid, top, width - mid, height)

    this.ctx.fillStyle = `rgba(0,123,255,0.4)`
    this.ctx.fillRect(0, top, mid, height)
  }
  drawError = (originOfError: string) => {
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
  getDraft(rect: Rect) {
    return this.draftCtx.getImageData(
      rect.leftPos,
      rect.topPos,
      rect.width,
      rect.height
    )
  }
  putDraft(
    picture: ImageData | rgb | null,
    left: number = 0,
    top: number = 0
  ) {
    const { width, height } = this.draftCanvas
    if (!picture) {
      this.draftCtx.clearRect(0, 0, width, height)
    } else if (picture instanceof ImageData) {
      this.draftCtx.putImageData(picture, left, top)
    } else {
      this.draftCtx.fillStyle = `rgb(${picture.join(',')} )`
      this.draftCtx.fillRect(0, 0, width, height)
    }
  }
  drawDraft() {
    this.ctx.drawImage(this.draftCanvas, 0, 0) // 真正的视图画布
  }
}
