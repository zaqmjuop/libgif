import { lzwDecode } from './lzwDecode'
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
} from '../type'
import { createWorkerFunc } from '../utils/createWorkerFunc'
import { DecodedStore } from '../store/decoded'

// Disposal method indicates the way in which the graphic is to be treated after being displayed.
enum DisposalMethod {
  ignore = 0, // No disposal specified. The decoder is not required to take any action.
  skip = 1, // Do not dispose. The graphic is to be left in place.
  backgroundColor = 2, //  Restore to background color. The area used by the graphic must be restored to the background color.
  previous = 3 // Restore to previous. The decoder is required to restore the area overwritten by the graphic with what was there prior to rendering the graphic.
} // Importantly, "previous" means the frame state after the last disposal of method 0, 1, or 2.

const workerLzwDecode = createWorkerFunc(lzwDecode)

export class Gif89aDecoder {
  private readonly canvas = document.createElement('canvas') // 图片文件原始模样
  private readonly ctx: CanvasRenderingContext2D
  private st: Stream | null = null
  key = ''
  private header?: Header
  private graphControll?: GCExtBlock
  public app?: AppExtBlock
  private exts: ExtBlock[] = []
  private opacity = 255
  frameGroup: Array<Frame & Rect> = []
  constructor() {
    this.ctx = this.canvas.getContext('2d', {
      willReadFrequently: true // https://html.spec.whatwg.org/multipage/canvas.html#concept-canvas-will-read-frequently
    }) as CanvasRenderingContext2D
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

  // LZW (GIF-specific)
  private parseColorTable = (entries: number) => {
    if (!this.st) return
    // Each entry is 3 bytes, for RGB.
    const colorTable: rgb[] = []
    for (let i = 0; i < entries; i++) {
      colorTable.push(this.st.readBytes(3) as rgb)
    }
    return colorTable
  }

  private readSubBlocks = () => {
    if (!this.st) return
    let size: number
    let data: string
    data = ''
    do {
      size = this.st.readByte()
      data += this.st.read(size)
    } while (size !== 0)
    return data
  }

  private parseHeader = () => {
    if (!this.st) return
    const signature = this.st.read(3)
    const version = this.st.read(3)
    if (signature !== 'GIF') throw new Error('Not a GIF file.') // XXX: This should probably be handled more nicely.
    const logicalScreenWidth = this.st.readUnsigned()
    const logicalScreenHeight = this.st.readUnsigned()

    const bits = byteToBitArr(this.st.readByte())
    const globalColorTableFlag = !!bits.shift()
    const ColorResolution = bitsToNum(bits.splice(0, 3))
    const sortFlag = !!bits.shift()
    const ColorTableSize = bitsToNum(bits.splice(0, 3))

    const backgroundColorIndex = this.st.readByte()
    const pixelAspectRatio = this.st.readByte() // if not 0, aspectRatio = (pixelAspectRatio + 15) / 64
    const globalColorTable = globalColorTableFlag
      ? this.parseColorTable(1 << (ColorTableSize + 1))
      : undefined
    const backgroundColor = globalColorTable
      ? globalColorTable[backgroundColorIndex]
      : null
    const header: Header = {
      signature,
      version,
      logicalScreenWidth,
      logicalScreenHeight,
      globalColorTableFlag,
      ColorResolution,
      sortFlag,
      ColorTableSize,
      backgroundColorIndex,
      backgroundColor,
      pixelAspectRatio,
      globalColorTable
    }
    this.header = header
    this.setCanvasSize(header.logicalScreenWidth, header.logicalScreenHeight)
    DecodedStore.setHeader(this.key, header)
    return header
  }

  private setCanvasSize(width: number, height: number) {
    this.canvas.width = width
    this.canvas.height = height
    this.canvas.style.width = width + 'px'
    this.canvas.style.height = height + 'px'
    this.ctx.setTransform(1, 0, 0, 1, 0, 0)
  }

  private parseExt = (block: Block) => {
    if (!this.st) return
    const parseGCExt = (block: ExtBlock) => {
      /**
       * Graphic Control Extension 可选，作用范围是紧跟其后的一个img
       *   透明度: transparencyGiven && colorTable[transparencyIndex]
       *   操作函数：disposalMethod
       *   帧时间：delayTime 如果没值，是10ms
       *
       */
      if (!this.st) return
      const blockSize = this.st.readByte() // Always 4
      const bits = byteToBitArr(this.st.readByte())
      const reserved = bits.splice(0, 3) // Reserved; should be 000.
      const disposalMethod = bitsToNum(bits.splice(0, 3))
      const userInput = !!bits.shift()
      const transparencyGiven = !!bits.shift()

      const delayTime = this.st.readUnsigned() * 10

      const transparencyIndex = this.st.readByte()

      const terminator = this.st.readByte()
      const graphControllExt = {
        ...block,
        reserved,
        disposalMethod,
        userInput,
        transparencyGiven,
        delayTime,
        transparencyIndex,
        terminator
      }
      this.graphControll = graphControllExt
    }

    const parseComExt = (block: ExtBlock) => {
      if (!this.st) return
      const comment = this.readSubBlocks()
      const comExt = { ...block, comment }
      this.exts.push(comExt)
      DecodedStore.pushBlocks(this.key, [comExt])
      return comExt
    }

    const parsePTExt = (block: ExtBlock) => {
      if (!this.st) return
      // No one *ever* uses this. If you use it, deal with parsing it yourself.
      const blockSize = this.st.readByte() // Always 12
      const ptHeader = this.st.readBytes(12)
      const ptData = this.readSubBlocks()
      const pteExt = { ...block, ptHeader, ptData }
      this.exts.push(pteExt)
      DecodedStore.pushBlocks(this.key, [pteExt])
      return pteExt
    }

    const parseAppExt = (block: ExtBlock) => {
      if (!this.st) return
      const parseNetscapeExt = (block: AppExtBlock) => {
        if (!this.st) return
        const blockSize = this.st.readByte() // Always 3
        const unknown = this.st.readByte() // ??? Always 1? What is this?
        const iterations = this.st.readUnsigned()
        const terminator = this.st.readByte()
        const appExt = {
          ...block,
          unknown,
          iterations,
          terminator,
          identifier: 'NETSCAPE'
        }
        this.app = appExt
        DecodedStore.pushBlocks(this.key, [appExt])
        return appExt
      }

      const parseUnknownAppExt = (block: AppExtBlock) => {
        const appData = this.readSubBlocks()
        const appExt = { ...block, appData, identifier: block.identifier }
        this.app = appExt
        // FIXME: This won't work if a handler wants to match on any identifier.
        DecodedStore.pushBlocks(this.key, [appExt])
        return appExt
      }

      const blockSize = this.st.readByte() // Always 11
      const identifier = this.st.read(8)
      const authCode = this.st.read(3)
      const appBlock: AppExtBlock = { ...block, identifier, authCode }
      switch (appBlock.identifier) {
        case 'NETSCAPE':
          parseNetscapeExt(appBlock)
          break
        default:
          parseUnknownAppExt(appBlock)
          break
      }
      return appBlock
    }

    const parseUnknownExt = (block: ExtBlock) => {
      const data = this.readSubBlocks()
      const unknownExt = { ...block, data }
      this.exts.push(unknownExt)
      DecodedStore.pushBlocks(this.key, [unknownExt])
      return unknownExt
    }

    const label = this.st.readByte()
    const extBlock: ExtBlock = {
      ...block,
      label,
      extType: ''
    }
    switch (extBlock.label) {
      case 0xf9:
        extBlock.extType = 'gce'
        return parseGCExt(extBlock)
      case 0xfe:
        extBlock.extType = 'com'
        return parseComExt(extBlock)
      case 0x01:
        extBlock.extType = 'pte'
        return parsePTExt(extBlock)
      case 0xff:
        extBlock.extType = 'app'
        return parseAppExt(extBlock)
      default:
        extBlock.extType = 'unknown'
        return parseUnknownExt(extBlock)
    }
  }

  private parseImg = async (
    block: Block
  ): Promise<void | (ImgBlock & { frame: Frame & Rect })> => {
    if (!this.st) return
    const deinterlace = (pixels: number[], width: number) => {
      // Of course this defeats the purpose of interlacing. And it's *probably*
      // the least efficient way it's ever been implemented. But nevertheless...
      const newPixels: number[] = new Array(pixels.length)
      const rows = pixels.length / width
      const cpRow = (toRow: number, fromRow: number) => {
        const fromPixels = pixels.slice(fromRow * width, (fromRow + 1) * width)
        newPixels.splice(toRow * width, width, ...fromPixels)
      }

      // See appendix E.
      const offsets = [0, 4, 2, 1]
      const steps = [8, 8, 4, 2]
      // todo变成原地成为插行
      let fromRow = 0
      for (let pass = 0; pass < 4; pass++) {
        for (let toRow = offsets[pass]; toRow < rows; toRow += steps[pass]) {
          cpRow(toRow, fromRow)
          fromRow++
        }
      }

      return newPixels
    }
    /**
     * 有用的信息
     * leftPos、topPos、width、height
     * interlaced隔行的
     * sorted 如果是排序的，那么lct是按重要性递减排序
     * pixels
     */
    const leftPos = this.st.readUnsigned()
    const topPos = this.st.readUnsigned()
    const width = this.st.readUnsigned()
    const height = this.st.readUnsigned()

    const bits = byteToBitArr(this.st.readByte())
    const lctFlag = bits.shift()
    const interlaced = bits.shift()
    const sorted = bits.shift()
    const reserved = bits.splice(0, 2)
    const lctSize = bitsToNum(bits.splice(0, 3))

    const lct = lctFlag ? this.parseColorTable(1 << (lctSize + 1)) : undefined

    const lzwMinCodeSize = this.st.readByte()

    const lzwData: string = this.readSubBlocks() as string

    let pixels: number[] = await workerLzwDecode(lzwMinCodeSize, lzwData)
    // Move
    if (interlaced) {
      pixels = deinterlace(pixels, width)
    }

    const img: ImgBlock = {
      ...block,
      leftPos,
      topPos,
      width,
      height,
      lctFlag,
      interlaced,
      sorted,
      reserved,
      lctSize,
      lct,
      lzwMinCodeSize,
      pixels
    }
    const frame = this.parseFrame(img)
    return { ...img, frame }
  }

  private parseFrame = (img: ImgBlock): Frame & Rect => {
    // graphControll
    const graphControll = this.graphControll
    if (graphControll) {
      this.disposal(graphControll.disposalMethod)
    }
    const transparency =
      graphControll && graphControll.transparencyGiven
        ? graphControll.transparencyIndex
        : null
    const delayTime = (graphControll && graphControll.delayTime) || 100 //  默认间隔100ms
    const colorTable = img.lctFlag
      ? img.lct
      : (this.header?.globalColorTable as rgb[]) // TODO: What if neither exists? 调用系统颜色表
    //Get existing pixels for img region after applying disposal method

    const imgData: ImageData = this.ctx.getImageData(
      img.leftPos,
      img.topPos,
      img.width,
      img.height
    )
    if (colorTable) {
      img.pixels.forEach((pixel, i) => {
        if (pixel !== transparency) {
          imgData.data[i * 4 + 0] = colorTable[pixel][0]
          imgData.data[i * 4 + 1] = colorTable[pixel][1]
          imgData.data[i * 4 + 2] = colorTable[pixel][2]
          imgData.data[i * 4 + 3] = this.opacity // Opaque.
        }
      })
    }
    this.ctx.putImageData(
      imgData,
      img.leftPos,
      img.topPos,
      0,
      0,
      img.width,
      img.height
    )
    const frame: Frame & Rect = {
      data: this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height),
      delay: delayTime,
      leftPos: 0,
      topPos: 0,
      width: this.canvas.width,
      height: this.canvas.height
    }
    this.frameGroup.push(frame)

    this.graphControll = void 0
    DecodedStore.pushFrames(this.key, [frame])
    return frame
  }

  private disposal(method: number | null) {
    const restoreFrame = (flag: number) => {
      const frame = this.frameGroup[flag]
      if (frame) {
        this.putDraft(frame.data, frame.leftPos, frame.topPos)
      } else {
        this.putDraft(this.header?.backgroundColor || null)
      }
    }

    switch (method) {
      case DisposalMethod.previous:
        restoreFrame(this.frameGroup.length - 1)
        break
      case DisposalMethod.backgroundColor:
        restoreFrame(-1)
        break
    }
  }

  private putDraft = (
    picture: ImageData | rgb | null,
    left: number = 0,
    top: number = 0
  ) => {
    const { width, height } = this.canvas
    if (!picture) {
      this.ctx.clearRect(0, 0, width, height)
    } else if (picture instanceof ImageData) {
      this.ctx.putImageData(picture, left, top)
    } else {
      this.ctx.fillStyle = `rgb(${picture.join(',')} )`
      this.ctx.fillRect(0, 0, width, height)
    }
  }

  private parseBlock = async () => {
    if (!this.st) return
    const sentinel = this.st.readByte()
    const block: Block = {
      sentinel,
      type: ''
    }

    const onComplete = () => {
      block.type = 'complete'
      this.st = null
      this.key = ''
      return block
    }

    switch (
      String.fromCharCode(block.sentinel) // For ease of matching
    ) {
      case '!':
        block.type = 'ext'
        return this.parseExt(block)
      case ',':
        block.type = 'img'
        return this.parseImg(block)
      case ';':
        return onComplete()
      case '\x00':
        return onComplete()
      default:
        throw new Error('Unknown block: 0x' + block.sentinel.toString(16)) // TODO: Pad this with a 0.
    }
  }

  public parse = async (
    st: Stream,
    key: string,
    config?: { opacity: number }
  ) => {
    if (this.st) return
    this.st = st
    this.key = key
    if (config) {
      this.opacity = config.opacity
    }
    const blocks: Block[] = []
    const header = this.parseHeader()
    while (this.st) {
      const block = await this.parseBlock()
      block && blocks.push(block)
    }
    const completeData = {
      header,
      blocks,
      frameGroup: this.frameGroup,
      opacity: this.opacity
    }
    DecodedStore.setComplete(key)
    return completeData
  }
}
