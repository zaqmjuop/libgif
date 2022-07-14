import { lzwDecode } from './lzwDecode'
import { bitsToNum, byteToBitArr, Stream } from './stream'
import {
  AppExtBlock,
  Block,
  ExtBlock,
  Hander,
  Header,
  ImgBlock,
  PTExtBlock,
  UnknownAppExtBlock
} from './type'

// The actual parsing; returns an object with properties.
export class GifParser {
  st: Stream
  handler: Hander
  constructor(st: Stream, handler: Hander) {
    this.st = st
    this.handler = handler
    this.parse()
  }

  // LZW (GIF-specific)
  parseCT = (entries: number) => {
    // Each entry is 3 bytes, for RGB.
    const ct: number[][] = []
    for (let i = 0; i < entries; i++) {
      ct.push(this.st.readBytes(3))
    }
    return ct
  }

  readSubBlocks = () => {
    let size: number
    let data: string
    data = ''
    do {
      size = this.st.readByte()
      data += this.st.read(size)
    } while (size !== 0)
    return data
  }

  parseHeader = () => {
    const sig = this.st.read(3)
    const ver = this.st.read(3)
    if (sig !== 'GIF') throw new Error('Not a GIF file.') // XXX: This should probably be handled more nicely.
    const width = this.st.readUnsigned()
    const height = this.st.readUnsigned()

    const bits = byteToBitArr(this.st.readByte())
    const gctFlag = !!bits.shift()
    const colorRes = bitsToNum(bits.splice(0, 3))
    const sorted = !!bits.shift()
    const gctSize = bitsToNum(bits.splice(0, 3))

    const bgColor = this.st.readByte()
    const pixelAspectRatio = this.st.readByte() // if not 0, aspectRatio = (pixelAspectRatio + 15) / 64
    const gct = gctFlag ? this.parseCT(1 << (gctSize + 1)) : undefined
    const header: Header = {
      sig,
      ver,
      width,
      height,
      gctFlag,
      colorRes,
      sorted,
      gctSize,
      bgColor,
      pixelAspectRatio,
      gct
    }
    this.handler.hdr && this.handler.hdr(header)
  }

  parseExt = (block: Block) => {
    const parseGCExt = (block: ExtBlock) => {
      const blockSize = this.st.readByte() // Always 4
      const bits = byteToBitArr(this.st.readByte())
      const reserved = bits.splice(0, 3) // Reserved; should be 000.
      const disposalMethod = bitsToNum(bits.splice(0, 3))
      const userInput = !!bits.shift()
      const transparencyGiven = !!bits.shift()

      const delayTime = this.st.readUnsigned()

      const transparencyIndex = this.st.readByte()

      const terminator = this.st.readByte()

      this.handler.gce &&
        this.handler.gce({
          ...block,
          reserved,
          disposalMethod,
          userInput,
          transparencyGiven,
          delayTime,
          transparencyIndex,
          terminator
        })
    }

    const parseComExt = (block: ExtBlock) => {
      const comment = this.readSubBlocks()
      this.handler.com && this.handler.com({ ...block, comment })
    }

    const parsePTExt = (block: ExtBlock) => {
      // No one *ever* uses this. If you use it, deal with parsing it yourself.
      const blockSize = this.st.readByte() // Always 12
      const ptHeader = this.st.readBytes(12)
      const ptData = this.readSubBlocks()
      this.handler.pte && this.handler.pte({ ...block, ptHeader, ptData })
    }

    const parseAppExt = (block: ExtBlock) => {
      const parseNetscapeExt = (block: AppExtBlock) => {
        const blockSize = this.st.readByte() // Always 3
        const unknown = this.st.readByte() // ??? Always 1? What is this?
        const iterations = this.st.readUnsigned()
        const terminator = this.st.readByte()
        this.handler.app &&
          this.handler.app.NETSCAPE &&
          this.handler.app.NETSCAPE({
            ...block,
            unknown,
            iterations,
            terminator
          })
      }

      const parseUnknownAppExt = (block: AppExtBlock) => {
        const appData = this.readSubBlocks()
        // FIXME: This won't work if a handler wants to match on any identifier.
        this.handler.app &&
          this.handler.app[block.identifier] &&
          this.handler.app[block.identifier]({ ...block, appData })
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
    }

    const parseUnknownExt = (block: ExtBlock) => {
      const data = this.readSubBlocks()
      const unknownExtBlock = { ...block, data }
      this.handler.unknown && this.handler.unknown(unknownExtBlock)
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
        parseGCExt(extBlock)
        break
      case 0xfe:
        extBlock.extType = 'com'
        parseComExt(extBlock)
        break
      case 0x01:
        extBlock.extType = 'pte'
        parsePTExt(extBlock)
        break
      case 0xff:
        extBlock.extType = 'app'
        parseAppExt(extBlock)
        break
      default:
        extBlock.extType = 'unknown'
        parseUnknownExt(extBlock)
        break
    }
  }

  parseImg = (block: Block) => {
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

    const lct = lctFlag ? this.parseCT(1 << (lctSize + 1)) : undefined

    const lzwMinCodeSize = this.st.readByte()

    const lzwData = this.readSubBlocks()

    let pixels: number[] = lzwDecode(lzwMinCodeSize, lzwData)
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
    this.handler.img && this.handler.img(img)
  }

  parseBlock = () => {
    const sentinel = this.st.readByte()
    const block: Block = {
      sentinel,
      type: ''
    }

    switch (
      String.fromCharCode(block.sentinel) // For ease of matching
    ) {
      case '!':
        block.type = 'ext'
        this.parseExt(block)
        break
      case ',':
        block.type = 'img'
        this.parseImg(block)
        break
      case ';':
        block.type = 'eof'
        this.handler.eof && this.handler.eof(block)
        break
      default:
        throw new Error('Unknown block: 0x' + block.sentinel.toString(16)) // TODO: Pad this with a 0.
    }

    if (block.type !== 'eof') setTimeout(this.parseBlock, 0)
  }

  parse = () => {
    this.parseHeader()
    setTimeout(this.parseBlock, 0)
  }
}
