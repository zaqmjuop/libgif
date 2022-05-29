import { bitsToNum, byteToBitArr } from '@/lib/back/utils'
import { Stream } from '@/lib/back/Stream'
import { isKeyof } from '@/utils'
import { lzwDecode } from '@/lib/back/lzwDecode'
import { CHECKINDEX } from '@/metaData'
type rgb = [number, number, number]

export interface GifHeader {
  sig: 'GIF'
  ver: string //'89a' | '87a'
  width: number
  height: number
  gctFlag: boolean
  colorRes: number
  sorted: boolean
  gctSize: number
  bgIndex: number
  pixelAspectRatio: number
  gct?: rgb[]
}

export interface GifImg {
  left: number
  top: number
  width: number
  height: number
  lctFlag: boolean
  interlaced: boolean
  sorted: boolean
  reserved: boolean[]
  lctSize: number
  lct?: rgb[]
  lzwMinCodeSize: number
  lzwData: Uint8Array
  pixels: Uint8Array
}

export interface GraphicControlExtension {
  reserved: boolean[]
  disposalMethod: number
  userInput: boolean
  delayTime: number
  transparency: number
}
export interface ApplicationExtension {
  identifier: string
  authCode: string
  data: any
}
export interface PlainTextExtension {
  textGridLeft: number
  textGridTop: number
  textGridWidth: number
  textGridHeight: number
  charWidth: number
  charHeight: number
  textColorIndex: number
  textBgColorIndex: number
  ptData: Uint8Array
}

export interface GifFrame {
  width: number
  height: number
  transparency: number
  delayTime: number
  disposalMethod: number
  imageData: ImageData
}
// LZW (GIF-specific)
const parseCT = (entries: number, st: Stream) => {
  // Each entry is 3 bytes, for RGB.
  const colorTable: rgb[] = []
  for (let i = 0; i < entries; i++) {
    colorTable.push(st.readBytes(3) as rgb)
  }
  return colorTable
}

const deinterlace = (pixels: Uint8Array, width: number): Uint8Array => {
  // Of course this defeats the purpose of interlacing. And it's *probably*
  // the least efficient way it's ever been implemented. But nevertheless...
  const newPixels = new Uint8Array(pixels.length)
  const rows = pixels.length / width
  const cpRow = (toRow: 0 | 4 | 2 | 1, fromRow: number) => {
    const fromPixels = pixels.slice(fromRow * width, (fromRow + 1) * width)
    Array.prototype.splice.call(newPixels, toRow * width, width, ...fromPixels)
  }

  // See appendix E.
  const offsets = [0, 4, 2, 1] as const
  const steps = [8, 8, 4, 2] as const

  let fromRow = 0
  for (let pass = 0; pass < 4; pass++) {
    for (let toRow = offsets[pass]; toRow < rows; toRow += steps[pass]) {
      cpRow(toRow, fromRow)
      fromRow++
    }
  }
  return newPixels
}

const EXT_TYPE_MAP = {
  0xf9: 'gcExt',
  0xfe: 'comExt',
  0x01: 'ptExt',
  0xff: 'appExt'
} as const

const BLOCK_MAP = {
  '!': 'ext',
  ',': 'img',
  ';': 'eof'
} as const

export class GifParser {
  st: Stream
  header: GifHeader | null = null
  gcExt: GraphicControlExtension | null = null
  appExt: ApplicationExtension | null = null
  ptExt: PlainTextExtension | null = null
  comments: string[] = []
  unknowns: any[] = []
  imgs: GifImg[] = []
  frames: GifFrame[] = []
  start: number
  promise: null | Promise<GifParser> = null
  blocks: any[] = []
  constructor(st: Stream) {
    this.start = Date.now()
    this.st = st
  }
  static async of(st: Stream) {
    const p = new GifParser(st)
    return p.parse()
  }
  async parse() {
    if (!this.promise) {
      this.promise = Promise.resolve()
        .then(() => this.parseHeader())
        .then(() => this.parseBlock())
    }
    return this.promise
  }
  parseHeader() {
    const { st } = this
    const [sig, ver] = [st.read(3), st.read(3)]
    if (sig !== 'GIF') {
      throw new Error('Not a GIF file.') // XXX: This should probably be handled more nicely.
    }
    const [width, height, bits, bgIndex, pixelAspectRatio] = [
      st.readUnsigned(),
      st.readUnsigned(),
      byteToBitArr(st.readByte()),
      st.readByte(),
      st.readByte() // if not 0, aspectRatio = (pixelAspectRatio + 15) / 64
    ]
    const [gctFlag, colorRes, sorted, gctSize] = [
      bits.shift(),
      bitsToNum(bits.splice(0, 3)),
      bits.shift(),
      bitsToNum(bits.splice(0, 3))
    ]
    const gct = gctFlag ? parseCT(1 << (gctSize + 1), st) : undefined
    const header: GifHeader = {
      sig,
      ver,
      width,
      height,
      bgIndex,
      pixelAspectRatio,
      gctFlag: !!gctFlag,
      colorRes,
      sorted: !!sorted,
      gctSize,
      gct
    }
    this.header = header
    this.blocks.push(header)
    return header
  }
  private async parseBlock() {
    const { st } = this
    const sentinel = st.readByte()
    const sentinelChar = String.fromCharCode(sentinel)
    if (!isKeyof(sentinelChar, BLOCK_MAP)) {
      throw new Error('Unknown block: 0x' + sentinel.toString(16)) // TODO: Pad this with a 0.
    }
    const type = BLOCK_MAP[sentinelChar]
    let block
    switch (type) {
      case 'ext':
        block = await this.parseExt()
        this.blocks.push({ type, block })
        return this.parseBlock()
      case 'img':
        block = await this.parseImg()
        this.blocks.push({ type, block })
        return this.parseBlock()
      case 'eof':
        console.log('解析完毕', Date.now() - this.start)
        return this
    }
  }
  parseExt() {
    const { st } = this
    const label = st.readByte()
    const extType = isKeyof(label, EXT_TYPE_MAP)
      ? EXT_TYPE_MAP[label]
      : 'unknownExt'
    let res
    const NEXT_MAP = {
      gcExt: () => this.parseGCExt(),
      comExt: () => this.parseComExt(),
      ptExt: () => this.parsePTExt(),
      appExt: () => this.parseAppExt(),
      unknownExt: () => this.parseUnknownExt()
    } as const
    res = NEXT_MAP[extType]()
    return { extType: res }
  }
  parseImg() {
    const { st } = this
    const [left, top, width, height] = [
      st.readUnsigned(),
      st.readUnsigned(),
      st.readUnsigned(),
      st.readUnsigned()
    ]
    const bits = byteToBitArr(st.readByte())
    const [lctFlag, interlaced, sorted, reserved, lctSize] = [
      !!bits.shift(),
      !!bits.shift(),
      !!bits.shift(),
      bits.splice(0, 2),
      bitsToNum(bits.splice(0, 3))
    ]
    const lct = lctFlag ? parseCT(1 << (lctSize + 1), st) : undefined
    const lzwMinCodeSize = st.readByte()
    const lzwData = st.readSubBlocks()
    let pixels = lzwDecode(lzwMinCodeSize, lzwData)
    if (interlaced) {
      // Move
      pixels = deinterlace(pixels, width)
    }
    const img: GifImg = {
      left,
      top,
      width,
      height,
      lctFlag,
      interlaced,
      sorted,
      reserved,
      lctSize,
      lct,
      lzwMinCodeSize,
      lzwData,
      pixels
    }
    // throw new Error('img')
    this.imgs.push(img)
    this.pushFrame(img)
    return img
  }
  pushFrame(img: GifImg) {
    if (!this.gcExt) {
      return
    }
    const { transparency, delayTime, disposalMethod } = this.gcExt
    const { pixels, width, height, lct } = img
    const ct = lct || this.header?.gct
    if (!ct) {
      return
    }
    /*
      disposal method 0~7
      1 解码器不会清理画布，直接将下一幅图像渲染上一幅图像上。
      2 解码器会以背景色清理画布，然后渲染下一幅图像。背景色在逻辑屏幕描述符中设置。
      3 解码器会将画布设置为上之前的状态，然后渲染下一幅图像。
      4-7 保留值
    */
    const data = new Uint8ClampedArray(pixels.length * 4)
    for (let i = 0; i < pixels.length; i++) {
      const pixel = pixels[i]
      if (pixel !== transparency) {
        const pix = ct[pixel]
        const idx = i * 4
        data[idx] = pix[0]
        data[idx + 1] = pix[1]
        data[idx + 2] = pix[2]
        data[idx + 3] = 255 // Opaque.
      }
    }
    const imageData = new ImageData(data, width, height)
    const frame: GifFrame = {
      width,
      height,
      transparency,
      delayTime,
      disposalMethod,
      imageData
    }
    this.frames.push(frame)
  }
  parseGCExt() {
    const { st } = this
    const blockSize = st.readByte() // Always 4
    const bits = byteToBitArr(st.readByte())
    const [reserved, disposalMethod, userInput, transparencyGiven] = [
      bits.splice(0, 3),
      bitsToNum(bits.splice(0, 3)),
      !!bits.shift(),
      !!bits.shift()
    ] // Reserved; should be 000.
    const delayTime = st.readUnsigned()
    const transparencyIndex = st.readByte()
    const terminator = st.readByte()
    const transparency = transparencyGiven ? transparencyIndex : 255
    const gcExt = {
      reserved,
      disposalMethod,
      userInput,
      transparency,
      delayTime
    }
    this.gcExt = gcExt
  }
  parseComExt() {
    const { st } = this
    const blockSize = st.readByte()
    const bytes = st.readBytes(blockSize)
    const chars: string[] = []
    for (let i = 0; i < bytes.length; i++) {
      chars[i] = String.fromCharCode(bytes[i])
    }
    const comment = chars.join('')
    const terminator = st.readByte()
    this.comments.push(comment)
  }
  parsePTExt() {
    const { st } = this
    // No one *ever* uses this. If you use it, deal with parsing it yourself.
    const blockSize = st.readByte() // Always 12
    const [
      textGridLeft,
      textGridTop,
      textGridWidth,
      textGridHeight,
      charWidth,
      charHeight,
      textColorIndex,
      textBgColorIndex
    ] = [
      st.readUnsigned(),
      st.readUnsigned(),
      st.readUnsigned(),
      st.readUnsigned(),
      st.readByte(),
      st.readByte(),
      st.readByte(),
      st.readByte()
    ]
    const ptData = st.readSubBlocks()
    const ptExt = {
      textGridLeft,
      textGridTop,
      textGridWidth,
      textGridHeight,
      charWidth,
      charHeight,
      textColorIndex,
      textBgColorIndex,
      ptData
    }
    this.ptExt = ptExt
  }
  parseNetscapeExt() {
    const { st } = this
    const blockSize = st.readByte() // Always 3
    const label = st.readByte() // Always 1
    const data = st.readUnsigned()
    const terminator = st.readByte()
    return data
  }
  parseUnknownAppExt() {
    const { st } = this
    const blockSize = st.readByte()
    const label = st.readByte()
    const data = st.readUnsigned()
    const terminator = st.readByte()
    // FIXME: This won't work if a handler wants to match on any identifier.
    return data
  }
  parseAppExt() {
    const { st } = this
    const blockSize = st.readByte() // Always 11
    const identifier = st.read(8)
    const authCode = st.read(3)
    const NEXT_MAP = {
      NETSCAPE: () => this.parseNetscapeExt()
    } as const

    const data = isKeyof(identifier, NEXT_MAP)
      ? NEXT_MAP[identifier]()
      : this.parseUnknownAppExt()
    this.appExt = { identifier, authCode, data }
  }
  parseUnknownExt() {
    const data = this.st.readSubBlocks()
    this.unknowns.push(data)
  }
}
