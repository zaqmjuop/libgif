import { lzwDecode } from './lzwDecode'
import { bitsToNum, byteToBitArr, Stream } from './stream'

export interface Hander {
  readonly hdr: (block: any) => void
  readonly gce: (block: any) => void
  readonly com: (block: any) => void
  readonly app: {
    readonly NETSCAPE: (block: any) => void
  }
  readonly img: (block: any) => void
  readonly eof: (block: any) => void
  readonly pte: (block: any) => void
  readonly unknown: (block: any) => void
}

// The actual parsing; returns an object with properties.
export const parseGIF = (st: Stream, handler: Hander) => {

  // LZW (GIF-specific)
  const parseCT = (entries) => {
    // Each entry is 3 bytes, for RGB.
    const ct: number[][] = []
    for (let i = 0; i < entries; i++) {
      ct.push(st.readBytes(3))
    }
    return ct
  }

  const readSubBlocks = () => {
    let size, data
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
    const gctFlag = bits.shift()
    const colorRes = bitsToNum(bits.splice(0, 3))
    const sorted = bits.shift()
    const gctSize = bitsToNum(bits.splice(0, 3))

    const bgColor = st.readByte()
    const pixelAspectRatio = st.readByte() // if not 0, aspectRatio = (pixelAspectRatio + 15) / 64
    let gct
    if (gctFlag) {
      gct = parseCT(1 << (gctSize + 1))
    }
    const header = {
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

  const parseExt = (block) => {
    const parseGCExt = (block) => {
      const blockSize = st.readByte() // Always 4
      const bits = byteToBitArr(st.readByte())
      block.reserved = bits.splice(0, 3) // Reserved; should be 000.
      block.disposalMethod = bitsToNum(bits.splice(0, 3))
      block.userInput = bits.shift()
      block.transparencyGiven = bits.shift()

      block.delayTime = st.readUnsigned()

      block.transparencyIndex = st.readByte()

      block.terminator = st.readByte()

      handler.gce && handler.gce(block)
    }

    const parseComExt = function (block) {
      block.comment = readSubBlocks()
      handler.com && handler.com(block)
    }

    const parsePTExt = function (block) {
      // No one *ever* uses this. If you use it, deal with parsing it yourself.
      const blockSize = st.readByte() // Always 12
      block.ptHeader = st.readBytes(12)
      block.ptData = readSubBlocks()
      handler.pte && handler.pte(block)
    }

    const parseAppExt = function (block) {
      const parseNetscapeExt = function (block) {
        const blockSize = st.readByte() // Always 3
        block.unknown = st.readByte() // ??? Always 1? What is this?
        block.iterations = st.readUnsigned()
        block.terminator = st.readByte()
        handler.app && handler.app.NETSCAPE && handler.app.NETSCAPE(block)
      }

      const parseUnknownAppExt = function (block) {
        block.appData = readSubBlocks()
        // FIXME: This won't work if a handler wants to match on any identifier.
        handler.app &&
          handler.app[block.identifier] &&
          handler.app[block.identifier](block)
      }

      const blockSize = st.readByte() // Always 11
      block.identifier = st.read(8)
      block.authCode = st.read(3)
      switch (block.identifier) {
        case 'NETSCAPE':
          parseNetscapeExt(block)
          break
        default:
          parseUnknownAppExt(block)
          break
      }
    }

    const parseUnknownExt = function (block) {
      block.data = readSubBlocks()
      handler.unknown && handler.unknown(block)
    }

    block.label = st.readByte()
    switch (block.label) {
      case 0xf9:
        block.extType = 'gce'
        parseGCExt(block)
        break
      case 0xfe:
        block.extType = 'com'
        parseComExt(block)
        break
      case 0x01:
        block.extType = 'pte'
        parsePTExt(block)
        break
      case 0xff:
        block.extType = 'app'
        parseAppExt(block)
        break
      default:
        block.extType = 'unknown'
        parseUnknownExt(block)
        break
    }
  }

  const parseImg = function (img) {
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

    img.leftPos = st.readUnsigned()
    img.topPos = st.readUnsigned()
    img.width = st.readUnsigned()
    img.height = st.readUnsigned()

    const bits = byteToBitArr(st.readByte())
    img.lctFlag = bits.shift()
    img.interlaced = bits.shift()
    img.sorted = bits.shift()
    img.reserved = bits.splice(0, 2)
    img.lctSize = bitsToNum(bits.splice(0, 3))

    if (img.lctFlag) {
      img.lct = parseCT(1 << (img.lctSize + 1))
    }

    img.lzwMinCodeSize = st.readByte()

    const lzwData = readSubBlocks()

    img.pixels = lzwDecode(img.lzwMinCodeSize, lzwData)

    if (img.interlaced) {
      // Move
      img.pixels = deinterlace(img.pixels, img.width)
    }
    handler.img && handler.img(img)
  }

  const parseBlock = () => {
    const block: Record<string, any> = {}
    block.sentinel = st.readByte()

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

  const parse = function () {
    parseHeader()
    setTimeout(parseBlock, 0)
  }

  parse()
}
