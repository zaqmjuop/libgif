export const lzwDecode = (minCodeSize: number, data: string | Uint8Array) => {
  /**
   * minCodeSize 取值范围 5～8
   * codeSize 6～12
   */
  // minCodeSize 编码长度9-12位 minCodeSize值是8～11，表示 0~511至0～4095
  // TODO: Now that the GIF parser is a bit different, maybe this should get an array of bytes instead of a String?
  let pos = 0 // Maybe this streaming thing should be merged with the Stream?
  const readCode = (size: number) => {
    let code = 0
    for (let i = 0; i < size; i++) {
      const val =
        data instanceof Uint8Array ? data[pos >> 3] : data.charCodeAt(pos >> 3)
      if (val & (1 << (pos & 7))) {
        code |= 1 << i
      }
      pos++
    }
    return code
  }

  const output: number[] = []

  const clearCode = 1 << minCodeSize // 清除编译表标记，值是原始数据长度加1，就是256/1024/4096
  const eoiCode = clearCode + 1 // 编译结束标记，值是清除码+1

  let codeSize = minCodeSize + 1
  let dict: number[][] = [] // 编译表

  const clear = () => {
    codeSize = minCodeSize + 1
    dict = []
    for (let i = 0; i < clearCode; i++) {
      dict[i] = [i]
    }
    dict[clearCode] = []
    dict[eoiCode] = null as any
  }

  let code: number = 0
  let prev: number

  while (true) {
    prev = code
    code = readCode(codeSize)

    if (code === clearCode) {
      clear()
      continue
    } else if (code === eoiCode) {
      break
    } else if (code > dict.length) {
      throw new Error('Invalid LZW code.')
    } else if (code === dict.length) {
      dict.push(dict[prev].concat(dict[prev][0]))
    } else if (prev !== clearCode) {
      dict.push(dict[prev].concat(dict[code][0]))
    }

    output.push(...dict[code])

    if (dict.length === 1 << codeSize && codeSize < 12) {
      // If we're at the prev code and codeSize is 12, the next code will be a clearCode, and it'll be 12 bits long.
      codeSize++
    }
    if (pos >= data.length * 8) {
      console.info('没有结束码的')
      break
    }
  }
  return output
}
