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
export const parseGIF = (st: Stream, handler: Hander) => {
  // LZW (GIF-specific)
  const parseCT = (entries: number) => {
    // Each entry is 3 bytes, for RGB.
    const ct: number[][] = []
    for (let i = 0; i < entries; i++) {
      ct.push(st.readBytes(3))
    }
    return ct
  }

  const readSubBlocks = () => {
    let size: number
    let data: string
    data = ''
    do {
      size = st.readByte()
      data += st.read(size)
    } while (size !== 0)
    return data
  }

  const parseHeader = () => {
    const sig = st.read(3)
    const ver = st.read(3)
    if (sig !== 'GIF') throw new Error('Not a GIF file.') // XXX: This should probably be handled more nicely.
    const width = st.readUnsigned()
    const height = st.readUnsigned()

    const bits = byteToBitArr(st.readByte())
    const gctFlag = !!bits.shift()
    const colorRes = bitsToNum(bits.splice(0, 3))
    const sorted = !!bits.shift()
    const gctSize = bitsToNum(bits.splice(0, 3))

    const bgColor = st.readByte()
    const pixelAspectRatio = st.readByte() // if not 0, aspectRatio = (pixelAspectRatio + 15) / 64
    const gct = gctFlag ? parseCT(1 << (gctSize + 1)) : undefined
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
    handler.hdr && handler.hdr(header)
  }

  const parseExt = (block: Block) => {
    const parseGCExt = (block: ExtBlock) => {
      const blockSize = st.readByte() // Always 4
      const bits = byteToBitArr(st.readByte())
      const reserved = bits.splice(0, 3) // Reserved; should be 000.
      const disposalMethod = bitsToNum(bits.splice(0, 3))
      const userInput = !!bits.shift()
      const transparencyGiven = !!bits.shift()

      const delayTime = st.readUnsigned()

      const transparencyIndex = st.readByte()

      const terminator = st.readByte()

      handler.gce &&
        handler.gce({
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

    const parseComExt = function (block: ExtBlock) {
      const comment = readSubBlocks()
      handler.com && handler.com({ ...block, comment })
    }

    const parsePTExt = function (block: ExtBlock) {
      // No one *ever* uses this. If you use it, deal with parsing it yourself.
      const blockSize = st.readByte() // Always 12
      const ptHeader = st.readBytes(12)
      const ptData = readSubBlocks()
      handler.pte && handler.pte({ ...block, ptHeader, ptData })
    }

    const parseAppExt = function (block: ExtBlock) {
      const parseNetscapeExt = function (block: AppExtBlock) {
        const blockSize = st.readByte() // Always 3
        const unknown = st.readByte() // ??? Always 1? What is this?
        const iterations = st.readUnsigned()
        const terminator = st.readByte()
        handler.app &&
          handler.app.NETSCAPE &&
          handler.app.NETSCAPE({ ...block, unknown, iterations, terminator })
      }

      const parseUnknownAppExt = function (block: AppExtBlock) {
        const appData = readSubBlocks()
        // FIXME: This won't work if a handler wants to match on any identifier.
        handler.app &&
          handler.app[block.identifier] &&
          handler.app[block.identifier]({ ...block, appData })
      }

      const blockSize = st.readByte() // Always 11
      const identifier = st.read(8)
      const authCode = st.read(3)
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
      const data = readSubBlocks()
      const unknownExtBlock = { ...block, data }
      handler.unknown && handler.unknown(unknownExtBlock)
    }

    const label = st.readByte()
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

  const parseImg = (block: Block) => {
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

      let fromRow = 0
      for (let pass = 0; pass < 4; pass++) {
        for (let toRow = offsets[pass]; toRow < rows; toRow += steps[pass]) {
          cpRow(toRow, fromRow)
          fromRow++
        }
      }

      return newPixels
    }

    const leftPos = st.readUnsigned()
    const topPos = st.readUnsigned()
    const width = st.readUnsigned()
    const height = st.readUnsigned()

    const bits = byteToBitArr(st.readByte())
    const lctFlag = bits.shift()
    const interlaced = bits.shift()
    const sorted = bits.shift()
    const reserved = bits.splice(0, 2)
    const lctSize = bitsToNum(bits.splice(0, 3))

    const lct = lctFlag ? parseCT(1 << (lctSize + 1)) : undefined

    const lzwMinCodeSize = st.readByte()

    const lzwData = readSubBlocks()

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
    handler.img && handler.img(img)
  }

  const parseBlock = () => {
    const sentinel = st.readByte()
    const block: Block = {
      sentinel,
      type: ''
    }

    switch (
      String.fromCharCode(block.sentinel) // For ease of matching
    ) {
      case '!':
        block.type = 'ext'
        parseExt(block)
        break
      case ',':
        block.type = 'img'
        parseImg(block)
        break
      case ';':
        block.type = 'eof'
        handler.eof && handler.eof(block)
        break
      default:
        throw new Error('Unknown block: 0x' + block.sentinel.toString(16)) // TODO: Pad this with a 0.
    }

    if (block.type !== 'eof') setTimeout(parseBlock, 0)
  }

  const parse = () => {
    parseHeader()
    setTimeout(parseBlock, 0)
  }

  parse()
}
