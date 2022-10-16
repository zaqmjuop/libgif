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
  numArray: number[] = []
  private readonly emitter = new Emitter<typeof EMITS>()

  constructor(data: string | Uint8Array = '') {
    this.setData(data)
  }

  setData(data: string | Uint8Array) {
    this.data = data
    this.len = this.data.length
    this.emitter.emit('data')
  }

  readByteSync(): number {
    if (this.pos >= this.data.length) {
      throw new Error('Attempted to read past end of stream.')
    }

    let res = 0
    if (this.data instanceof Uint8Array) {
      res = this.data[this.pos++]
    } else {
      res = this.data.charCodeAt(this.pos++) & 0xff
    }
    if (this.pos >= 809 && this.pos <= 37569) {
      this.numArray.push(res)
    }

    return res
  }
  readByte = async (): Promise<number> => {
    const promise = new Promise<number>((resolve) => {
      const onData = () => {
        try {
          const res = this.readByteSync()
          this.emitter.off('data', onData)
          resolve(res)
        } catch {}
      }
      this.emitter.on('data', onData)
      onData()
    })
    return promise
  }
  readBytes = async (n: number): Promise<number[]> => {
    const bytes: number[] = []
    for (let i = 0; i < n; i++) {
      const byte = await this.readByte()
      bytes.push(byte)
    }
    return bytes
  }
  read = async (n: number) => {
    let s = ''
    for (let i = 0; i < n; i++) {
      const byte = await this.readByte()
      s += String.fromCharCode(byte)
    }
    return s
  }
  readUnsigned = async () => {
    const [n0, n1] = await this.readBytes(2)
    return (n1 << 8) + n0
  }
}
