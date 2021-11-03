export default class Stream {
  data: string | Uint8Array;
  len: number;
  index: number = 0;
  constructor(data: string | Uint8Array) {
    this.data = data;
    this.len = data.length;
  }

  readByte(): number {
    if (this.index >= this.data.length) {
      throw new Error("Attempted to read past end of stream.");
    } else if (this.data instanceof Uint8Array) {
      return this.data[this.index++];
    } else {
      return this.data.charCodeAt(this.index++) & 0xff;
    }
  }
  readBytes(n: number): number[] {
    const res: number[] = [];
    for (let i = n - 1; i >= 0; i--) {
      res.push(this.readByte());
    }
    return res;
  }

  readChars(n: number): string {
    let s = "";
    for (let i = n - 1; i >= 0; i--) {
      s += String.fromCharCode(this.readByte());
    }
    return s;
  }

  readCharsBlocks() {
    let size: number;
    let data = "";
    do {
      size = this.readByte();
      data += this.readChars(size);
    } while (size !== 0);
    return data;
  }

  readUnsigned(): number {
    // Little-endian.
    const [b0, b1] = this.readBytes(2); // 16进制数的个位和进1位
    return b0 + (b1 << 8);
  }
}
