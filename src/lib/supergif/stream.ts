// Generic functions
export const bitsToNum = (ba: boolean[]) =>
  ba.reduce((total, current) => total * 2 + Number(current), 0)

export const byteToBitArr = (bite: number) => {
  const arr: boolean[] = []
  for (let i = 7; i >= 0; i--) {
    arr.push(!!(bite & (1 << i)))
  }
  return arr
}

// Stream
/**
 * @constructor
 */
// Make compiler happy.
export class Stream {
  data: any
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
    return this.data instanceof Uint8Array
      ? this.data[this.pos++]
      : this.data.charCodeAt(this.pos++) & 0xff
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
    const [n0, n1] = this.readBytes(2)
    return (n1 << 8) + n0
  }
}
