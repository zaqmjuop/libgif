// Uint8Array 内的值的范围是 0-255
const generateBuffer = () => {
  let buffer: Uint8Array
  let offset: number
  const reset = () => {
    buffer = new Uint8Array(4096)
    offset = 0
  }
  reset()
  const enlarge = () => {
    const newbuffer = new Uint8Array(buffer.length << 1)
    newbuffer.set(buffer)
    buffer = newbuffer
  }
  const take = (length: number) => {
    while (offset + length > buffer.length) {
      enlarge()
    }
    const sub = buffer.subarray(offset, offset + length)
    offset += length
    return sub
  }
  const set = (ary: ArrayLike<number>) => {
    while (offset + ary.length > buffer.length) {
      enlarge()
    }
    buffer.set(ary, offset)
    offset += ary.length
  }
  return {
    take,
    set,
    reset,
    get offset() {
      return offset
    },
    set offset(val: number) {
      offset = val
    },
    get buffer() {
      return buffer
    }
  }
}
const getReadBit = (data: Uint8Array) => {
  let pos = 0 // Maybe this streaming thing should be merged with the Stream?
  const readBit = () => {
    // 返回 data 当前 pos 位是0还是1
    const res = data[pos >> 3] & (1 << (pos & 7))
    pos++
    return !!res
  }
  return readBit
}
export const lzwDecode = (minCodeSize: number, data: Uint8Array) => {
  const readBit = getReadBit(data)
  /**
   * data的每一位是 0-255，然后 0-255 可以转换成8位的 0｜1，所以data的含义是连续的 0|1 转成16进制了
   * 变量 pos 意思是2进制走一位，所以pos走8位就是data[index]走一位
   */
  const bufferFactory = generateBuffer()
  const outputFactory = generateBuffer()
  let pos = 0
  const readCode = (size: number) => {
    // 读取code值，code是长度在3-12位之间的0|1也就是最大值是4095
    let code = 0
    for (let i = 0; i < size; i++) {
      if (data[pos >> 3] & (1 << (pos & 7))) {
        code |= 1 << i
      }
      pos++
    }
    return code
  }

  const clearCode = 1 << minCodeSize
  const eoiCode = clearCode + 1

  let codeSize = minCodeSize + 1 // 表示code的长度，code值是字典长度时，说明code的位数要长一位，最多为12位，也就是code最大值4095
  const dict: Uint8Array[] = []

  const clear = () => {
    dict.splice(clearCode + 2, dict.length)
    codeSize = minCodeSize + 1
    bufferFactory.reset()
  }
  const fill = () => {
    for (let i = 0; i < clearCode; i++) {
      dict[i] = Uint8Array.from([i])
    }
    dict[clearCode] = new Uint8Array(0)
    dict[eoiCode] = new Uint8Array(0)
  }
  const pushCode = (code: number, prev: number) => {
    const prevLength = dict[prev].byteLength
    const newdict = bufferFactory.take(prevLength + 1)
    newdict.set(dict[prev])
    newdict[prevLength] = dict[code][0]

    dict.push(newdict)
  }

  let code = -1
  let prevCode = -1

  fill()

  // eslint-disable-next-line no-constant-condition
  while (true) {
    prevCode = code
    code = readCode(codeSize)
    if (pos >> 3 >= data.length) {
      break
    }
    if (code <= dict.length) {
      if (code === eoiCode) {
        break
      } else if (code === clearCode) {
        clear()
        continue
      } else {
        if (code === dict.length) {
          pushCode(prevCode, prevCode)
        } else if (prevCode !== clearCode) {
          // 如果code在字典里
          pushCode(code, prevCode)
        }

        outputFactory.set(dict[code]) // 输出结果

        if (dict.length === 1 << codeSize && codeSize < 12) {
          // 如果字典的长度超过了 code 长度的最大值，比如 code是8位，但字典长度来到了256。那么就把code长度增加一位
          // If we're at the last code and codeSize is 12, the next code will be a clearCode, and it'll be 12 bits long.
          codeSize++
        }
      }
    } else {
      // 如果code不在字典里
      throw new Error('Invalid LZW code.')
    }
  }

  // I don't know if this is technically an error, but some GIFs do it.
  if (Math.ceil(pos / 8) !== data.length)
    throw new Error('Extraneous LZW bytes.')
  // window.logs = logs
  const output = outputFactory.buffer.subarray(0, outputFactory.offset)

  if (data.length < 4096 && pos > 24000) {
    debugger
  }
  // debugger
  return output
}
