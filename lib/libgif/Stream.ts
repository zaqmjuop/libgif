export class Stream {
  data: string | Uint8Array
  len: number
  pos: number
  constructor(data: string | Uint8Array) {
    this.data = data
    this.len = this.data.length
    this.pos = 0
  }
  readByte() {
    if (this.pos >= this.data.length) {
      throw new Error('Attempted to read past end of stream.')
    }
    const data = this.data
    if (data instanceof Uint8Array) {
      return data[this.pos++]
    } else {
      return data.charCodeAt(this.pos++) & 0xff
    }
  }

  readBytes(n: number) {
    const bytes: number[] = []
    for (let i = 0; i < n; i++) {
      bytes.push(this.readByte())
    }
    return bytes
  }

  read(n: number) {
    let s = ''
    for (let i = 0; i < n; i++) {
      s += String.fromCharCode(this.readByte())
    }
    return s
  }

  readUnsigned() {
    // Little-endian.
    const a = this.readBytes(2)
    return (a[1] << 8) + a[0]
  }

  readSubBlocks() {
    let size: number
    let offset = 0
    const bufsize = 8192
    let data: Uint8Array = new Uint8Array(bufsize)

    const resizeBuffer = () => {
      const newdata = new Uint8Array(data.length + bufsize)
      newdata.set(data)
      data = newdata
    }
    do {
      size = this.readByte()

      // Increase buffer size if this would exceed our current size
      while (offset + size > data.length) {
        resizeBuffer()
      }
      data.set(this.readBytes(size), offset)
      offset += size
    } while (size !== 0)
    return data.subarray(0, offset) // truncate any excess buffer space
  }
}
