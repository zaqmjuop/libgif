import { isKeyof } from '@/utils'
import { lzwDecode } from './lzwDecode'
import { Stream } from './Stream'
import { bitsToNum, byteToBitArr } from './utils'

export interface Hander {
  hdr?: (block: any) => void
  gce?: (block: any) => void
  com?: (block: any) => void
  app?: {
    NETSCAPE?: (block: any) => void
  }
  img?: (block: any) => void
  eof?: (block: any) => void
  unknown?: (block: any) => void
  pte?: (block: any) => void
}

export const parseGIF = function (st: Stream, handler: Hander) {
  const start = Date.now()
  handler || (handler = {})

  // LZW (GIF-specific)
  const parseCT = function (entries: number) {
    // Each entry is 3 bytes, for RGB.
    const colorTable: number[][] = []
    for (let i = 0; i < entries; i++) {
      colorTable.push(st.readBytes(3))
    }
    return colorTable
  }

  const readSubBlocks = function () {
    let size: number
    let data: Uint8Array
    let offset = 0
    const bufsize = 8192
    data = new Uint8Array(bufsize)

    const resizeBuffer = function () {
      const newdata = new Uint8Array(data.length + bufsize)
      newdata.set(data)
      data = newdata
    }

    do {
      size = st.readByte()

      // Increase buffer size if this would exceed our current size
      while (offset + size > data.length) resizeBuffer()
      data.set(st.readBytes(size), offset)
      offset += size
    } while (size !== 0)
    return data.subarray(0, offset) // truncate any excess buffer space
  }

  const parseHeader = function () {
    const [sig, ver] = [st.read(3), st.read(3)]
    if (sig !== 'GIF') {
      throw new Error('Not a GIF file.') // XXX: This should probably be handled more nicely.
    }
    const [width, height, bits, bgColor, pixelAspectRatio] = [
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
    const gct = gctFlag ? parseCT(1 << (gctSize + 1)) : undefined
    handler.hdr &&
      handler.hdr({
        sig,
        ver,
        width,
        height,
        bgColor,
        pixelAspectRatio,
        gctFlag,
        colorRes,
        sorted,
        gctSize,
        gct
      })
  }

  const parseExt = function ({
    sentinel,
    type
  }: {
    sentinel: number
    type: 'ext'
  }) {
    const parseGCExt = function (block) {
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
    const label = st.readByte()
    const EXT_TYPE_MAP = {
      0xf9: 'gce',
      0xfe: 'com',
      0x01: 'pte',
      0xff: 'app'
    } as const
    const extType = isKeyof(label, EXT_TYPE_MAP)
      ? EXT_TYPE_MAP[label]
      : 'unknown'
    const NEXT_MAP = {
      gce: () => parseGCExt({ sentinel, type, label, extType: 'gce' }),
      com: () => parseComExt({ sentinel, type, label, extType: 'com' }),
      pte: () => parsePTExt({ sentinel, type, label, extType: 'pte' }),
      app: () => parseAppExt({ sentinel, type, label, extType: 'app' }),
      unknown: () =>
        parseUnknownExt({ sentinel, type, label, extType: 'unknown' })
    }
    NEXT_MAP[extType]()
  }

  const parseImg = function (img: { sentinel: number; type: 'img' }) {
    const deinterlace = function (pixels: Uint8Array, width: number) {
      // Of course this defeats the purpose of interlacing. And it's *probably*
      // the least efficient way it's ever been implemented. But nevertheless...
      const newPixels: number[] = new Array(pixels.length)
      const rows = pixels.length / width
      const cpRow = (toRow: 0 | 4 | 2 | 1, fromRow: number) => {
        const fromPixels = pixels.slice(fromRow * width, (fromRow + 1) * width)
        newPixels.splice(toRow * width, width, ...fromPixels)
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
    const [leftPos, topPos, width, height] = [
      st.readUnsigned(),
      st.readUnsigned(),
      st.readUnsigned(),
      st.readUnsigned()
    ]

    const bits = byteToBitArr(st.readByte())
    const [lctFlag, interlaced, sorted, reserved, lctSize] = [
      bits.shift(),
      bits.shift(),
      bits.shift(),
      bits.splice(0, 2),
      bitsToNum(bits.splice(0, 3))
    ]
    const lct = lctFlag ? parseCT(1 << (lctSize + 1)) : undefined
    const lzwMinCodeSize = st.readByte()
    const lzwData = readSubBlocks()
    let pixels: number[] | Uint8Array = lzwDecode(lzwMinCodeSize, lzwData)

    if (interlaced) {
      // Move
      pixels = deinterlace(pixels, width)
    }

    handler.img &&
      handler.img({
        ...img,
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
      })
  }

  const parseBlock = function () {
    const sentinel = st.readByte()
    const sentinelChar = String.fromCharCode(sentinel)
    const CHAR_MAP = {
      '!': 'ext',
      ',': 'img',
      ';': 'eof'
    } as const
    const type = isKeyof(sentinelChar, CHAR_MAP) ? CHAR_MAP[sentinelChar] : ''
    if (!type) {
      throw new Error('Unknown block: 0x' + sentinel.toString(16)) // TODO: Pad this with a 0.
    }

    const MOVE_MAP = {
      ext: () => parseExt({ sentinel, type: 'ext' }),
      img: () => parseImg({ sentinel, type: 'img' }),
      eof: () => {
        handler.eof && handler.eof({ sentinel, type: 'eof' })
      }
    } as const
    MOVE_MAP[type]()
    if (type !== 'eof') {
      setTimeout(parseBlock, 0)
    }
  }

  const parse = function () {
    parseHeader()
    setTimeout(parseBlock, 0)
  }

  parse()
}
