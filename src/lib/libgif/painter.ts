export class Painter {
  canvas = document.createElement('canvas')
  tmpCanvas = document.createElement('canvas')
  ctx: CanvasRenderingContext2D | null = null
  constructor(gif: HTMLImageElement) {
    this.canvas.width = gif.width
    this.canvas.height = gif.height
    this.ctx = this.canvas.getContext('2d')
    const parent = gif.parentNode
    if (parent) {
      const span = document.createElement('span')
      span.className = 'jsgif'
      span.appendChild(this.canvas)
      parent.insertBefore(span, gif)
    }
  }
  setSizes(w: number, h: number, scale = 1) {
    this.canvas.width = w * scale
    this.canvas.height = h * scale

    this.tmpCanvas.width = w
    this.tmpCanvas.height = h
    this.tmpCanvas.style.width = w + 'px'
    this.tmpCanvas.style.height = h + 'px'
    this.tmpCanvas.getContext('2d')?.setTransform(1, 0, 0, 1, 0, 0)
  }
}
