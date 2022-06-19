import { Stream } from './stream'
import { Frame, Hander, Header, ImgBlock, Offset, Rect } from './type'

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
  frame: CanvasRenderingContext2D | null
  delay: null | number
  frameOffsets: Offset[]
  lastDisposalMethod: number | null
  disposalRestoreFromIdx: number | null
  transparency: number | null
  drawWhileLoading: boolean
  auto_play: boolean
  lastImg: (Rect & Partial<ImgBlock>) | null
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
  pushFrame() {
    if (!this.quote.frame) return
    this.quote.frames.push({
      data: this.quote.frame.getImageData(
        0,
        0,
        this.quote.hdr.width,
        this.quote.hdr.height
      ),
      delay: this.quote.delay || -1
    })
    this.quote.frameOffsets.push({ x: 0, y: 0 })
  }

  doImg(img: ImgBlock) {
    if (!this.quote.frame && this.tmpCanvas) {
      this.quote.frame = this.tmpCanvas.getContext('2d')
    }

    let currIdx = frames.length

    //ct = color table, gct = global color table
    let ct = img.lctFlag ? img.lct : this.quote.hdr.gct // TODO: What if neither exists?

    /*
              Disposal method indicates the way in which the graphic is to
              be treated after being displayed.
  
              Values :    0 - No disposal specified. The decoder is
                              not required to take any action.
                          1 - Do not dispose. The graphic is to be left
                              in place.
                          2 - Restore to background color. The area used by the
                              graphic must be restored to the background color.
                          3 - Restore to previous. The decoder is required to
                              restore the area overwritten by the graphic with
                              what was there prior to rendering the graphic.
  
                              Importantly, "previous" means the frame state
                              after the last disposal of method 0, 1, or 2.
              */
    if (currIdx > 0) {
      if (this.quote.lastDisposalMethod === 3) {
        // Restore to previous
        // If we disposed every frame including first frame up to this point, then we have
        // no composited frame to restore to. In this case, restore to background instead.
        if (this.quote.disposalRestoreFromIdx !== null) {
          this.quote.frame?.putImageData(
            this.quote.frames[this.quote.disposalRestoreFromIdx].data,
            0,
            0
          )
        } else {
          this.quote.lastImg &&
            this.quote.frame?.clearRect(
              this.quote.lastImg.leftPos,
              this.quote.lastImg.topPos,
              this.quote.lastImg.width,
              this.quote.lastImg.height
            )
        }
      } else {
        this.quote.disposalRestoreFromIdx = currIdx - 1
      }

      if (this.quote.lastDisposalMethod === 2) {
        // Restore to background color
        // Browser implementations historically restore to transparent; we do the same.
        // http://www.wizards-toolkit.org/discourse-server/viewtopic.php?f=1&t=21172#p86079
        this.quote.lastImg &&
          this.quote.frame?.clearRect(
            this.quote.lastImg.leftPos,
            this.quote.lastImg.topPos,
            this.quote.lastImg.width,
            this.quote.lastImg.height
          )
      }
    }
    // else, Undefined/Do not dispose.
    // frame contains final pixel data from the last frame; do nothing

    //Get existing pixels for img region after applying disposal method
    if (this.quote.frame) {
      let imgData = this.quote.frame.getImageData(
        img.leftPos,
        img.topPos,
        img.width,
        img.height
      ) //apply color table colors
      img.pixels.forEach((pixel, i) => {
        // imgData.data === [R,G,B,A,R,G,B,A,...]
        if (pixel !== this.quote.transparency && ct) {
          imgData.data[i * 4 + 0] = ct[pixel][0]
          imgData.data[i * 4 + 1] = ct[pixel][1]
          imgData.data[i * 4 + 2] = ct[pixel][2]
          imgData.data[i * 4 + 3] = 255 // Opaque.
        }
      })

      this.quote.frame?.putImageData(imgData, img.leftPos, img.topPos)
    }

    if (!this.quote.ctx_scaled) {
      this.ctx.scale(
        this.quote.get_canvas_scale(),
        this.quote.get_canvas_scale()
      )
      this.quote.ctx_scaled = true
    }

    // We could use the on-page canvas directly, except that we draw a progress
    // bar for each image chunk (not just the final image).
    if (this.quote.drawWhileLoading) {
      this.tmpCanvas && this.ctx.drawImage(this.tmpCanvas, 0, 0)
      this.quote.drawWhileLoading = this.quote.auto_play
    }

    this.quote.lastImg = img
  }
  setFrameOffset(frame: number, offset: Offset) {
    if (!this.quote.frameOffsets[frame]) {
      this.quote.frameOffsets[frame] = offset
      return
    }
    if (typeof offset.x !== 'undefined') {
      this.quote.frameOffsets[frame].x = offset.x
    }
    if (typeof offset.y !== 'undefined') {
      this.quote.frameOffsets[frame].y = offset.y
    }
  }
}
