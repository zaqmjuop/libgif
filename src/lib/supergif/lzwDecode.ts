export const lzwDecode = (minCodeSize: number, data: string | Uint8Array) => {
  // TODO: Now that the GIF parser is a bit different, maybe this should get an array of bytes instead of a String?
  let pos = 0 // Maybe this streaming thing should be merged with the Stream?
  const readCode = (size: number) => {
    let code = 0
    for (let i = 0; i < size; i++) {
       const val = data instanceof Uint8Array ? data[pos >> 3]: data.charCodeAt(pos >> 3)
      if (val & (1 << (pos & 7))) {
        code |= 1 << i
      }
      pos++
    }
    return code
  }

  const output = []

  const clearCode = 1 << minCodeSize
  const eoiCode = clearCode + 1

  let codeSize = minCodeSize + 1

  let dict: any = []

  const clear = function () {
    dict = []
    codeSize = minCodeSize + 1
    for (let i = 0; i < clearCode; i++) {
      dict[i] = [i]
    }
    dict[clearCode] = []
    dict[eoiCode] = null
  }

  let code
  let last

  while (true) {
    last = code
    code = readCode(codeSize)

    if (code === clearCode) {
      clear()
      continue
    }
    if (code === eoiCode) break

    if (code < dict.length) {
      if (last !== clearCode) {
        dict.push(dict[last].concat(dict[code][0]))
      }
    } else {
      if (code !== dict.length) throw new Error('Invalid LZW code.')
      dict.push(dict[last].concat(dict[last][0]))
    }
    output.push.apply(output, dict[code])

    if (dict.length === 1 << codeSize && codeSize < 12) {
      // If we're at the last code and codeSize is 12, the next code will be a clearCode, and it'll be 12 bits long.
      codeSize++
    }
  }

  // I don't know if this is technically an error, but some GIFs do it.
  //if (Math.ceil(pos / 8) !== data.length) throw new Error('Extraneous LZW bytes.');
  return output
}
