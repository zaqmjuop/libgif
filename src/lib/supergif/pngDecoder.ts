import { Emitter } from './Emitter'
import { bitsToNum, byteToBitArr, Stream } from './stream'
import {
  AppExtBlock,
  Block,
  ExtBlock,
  Frame,
  GCExtBlock,
  Header,
  ImgBlock,
  Rect,
  rgb
} from './type'

export class PngDecoder extends Emitter {
  private readonly canvas = document.createElement('canvas') // 图片文件原始模样
  private readonly ctx: CanvasRenderingContext2D
  private st: Stream | null = null
  private header?: Header
  private graphControll?: GCExtBlock
  public app?: AppExtBlock
  private exts: ExtBlock[] = []
  private opacity = 255
  frameGroup: Array<Frame & Rect> = []
  constructor() {
    super()
    this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D
  }

  public get pos() {
    return this.st?.pos || 0
  }

  public get len() {
    return this.st?.data.length || 0
  }

  public get loading() {
    return !!this.st
  }

  public parse = (st: Stream, config?: { opacity: number }) => {
    if (this.st) return
    this.st = st
    if (config) {
      this.opacity = config.opacity
    }

  }
}
