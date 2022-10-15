import { Emitter } from '../utils/Emitter'
export const bitsToNum = (ba: boolean[]) =>
  ba.reduce((total, current) => total * 2 + Number(current), 0)

export const byteToBitArr = (bite: number) => {
  const arr: boolean[] = []
  for (let i = 7; i >= 0; i--) {
    arr.push(!!(bite & (1 << i)))
  }
  return arr
}

const EMITS = ['data'] as const

export class Stream {
  data: string | Uint8Array = ''
  len: number = 0
  pos = 0
  private readonly emitter = new Emitter<typeof EMITS>()

  constructor(data: string | Uint8Array = '') {
    this.setData(data)
  }

  setData(data: string | Uint8Array) {
    this.data = data
    this.len = this.data.length
    this.emitter.emit('data')
    console.log('setData')
  }

  readByte(): number {
    if (this.pos >= this.data.length) {
      console.log(this.pos, this.data.length)
      throw new Error('Attempted to read past end of stream.')
    }
    return this.data instanceof Uint8Array
      ? this.data[this.pos++]
      : this.data.charCodeAt(this.pos++) & 0xff
  }
  readBytes(n: number): number[] {
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
  readByteAsync = async (): Promise<number> => {
    const promise = new Promise<number>((resolve) => {
      const onData = () => {
        try {
          const res = this.readByte()
          this.emitter.off('data', onData)
          resolve(res)
        } catch {}
      }
      this.emitter.on('data', onData)
      onData()
    })
    return promise
  }
  readBytesAsync = async (n: number): Promise<number[]> => {
    const bytes: number[] = []
    for (let i = 0; i < n; i++) {
      const byte = await this.readByteAsync()
      bytes.push(byte)
    }
    return bytes
  }
  readAsync = async (n: number) => {
    let s = ''
    for (let i = 0; i < n; i++) {
      const byte = await this.readByteAsync()
      s += String.fromCharCode(byte)
    }
    return s
  }
  readUnsignedAsync = async () => {
    const [n0, n1] = await this.readBytesAsync(2)
    return (n1 << 8) + n0
  }
}
