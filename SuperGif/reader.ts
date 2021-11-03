import axios from "axios";
import { deinterlace, lzwDecode, toBinary } from "./helper";
import { RGB } from "./type";
const DEFAULT_DELAY = 40;
const DEFAULT_TRANSPARENCY = 255;
export class Reader {
  private index = 0;
  private view: DataView;
  constructor(buffer: ArrayBuffer) {
    this.view = new DataView(buffer);
  }
  readByte(): number {
    if (this.index >= this.view.byteLength) {
      throw new Error("Attempted to read past end of stream.");
    } else {
      return this.view.getUint8(this.index++);
    }
  }
  readBytes(n: number = 1): number[] {
    const res: number[] = [];
    for (let i = n - 1; i >= 0; i--) {
      res.push(this.readByte());
    }
    return res;
  }
  readChars(n: number = 1): string {
    let s = "";
    for (let i = n - 1; i >= 0; i--) {
      s += String.fromCharCode(this.readByte());
    }
    return s;
  }
  readSubBlocks() {
    let size: number;
    let data = "";
    do {
      size = this.readByte();
      data += this.readChars(size);
    } while (size !== 0);
    return data;
  }
  readUnsigned(): number {
    const bytes = this.readBytes(2);
    let res = bytes[0];
    let unit = 1;
    for (let i = 1; i < bytes.length; i++) {
      unit = unit << 8;
      res += bytes[i] * unit;
    }
    return res;
  }
}
const split8bit = (target: number, lens: number[]) => {
  const binary = toBinary(target);
  const res: number[] = [];
  let index = 0;
  for (let i = 0; i < lens.length && index < binary.length; i++) {
    const len = lens[i];
    res.push(parseInt(binary.slice(index, index + len), 2));
    index += len;
  }
  if (index < binary.length) {
    res.push(parseInt(binary.slice(index), 2));
  }
  return res;
};

export interface GIFParserOption {
  onParsed?: Function;
}
export interface GIFFrame {
  data: ImageData;
  left: number;
  top: number;
  delay: number;
}
export interface GraphicControl {
  delayTime: number;
  transparency: number;
  disposalMethod: number;
  userInputFlag: boolean;
}
/**
 * @todo 如果全局颜色表和局部颜色表都没有，怎么办？
 */
export class GIFParser {
  reader: Reader;
  header: { [x: string]: any } = {};
  globalColorTable: RGB[] = [];
  frames: GIFFrame[] = [];
  options: GIFParserOption;
  graphicControl: GraphicControl = {
    delayTime: DEFAULT_DELAY,
    transparency: DEFAULT_TRANSPARENCY,
    disposalMethod: 0,
    userInputFlag: false,
  };
  parseTime = NaN;
  constructor(data: ArrayBuffer, options: GIFParserOption = {}) {
    this.reader = new Reader(data);
    this.options = options;
    this.parse();
  }
  async parse() {
    const start = Date.now();
    await this.parseHeader();
    await this.parseLogicalScreenDescriptor();
    await this.parseBlock();
    this.parseTime = Date.now() - start;
    console.log(`%c解析用时：${this.parseTime}`, "color: red");
    this.options.onParsed && this.options.onParsed(this);
  }

  parseHeader() {
    const signature = this.reader.readChars(3); // "GIF"
    if (signature !== "GIF") {
      throw new Error("Not a GIF file."); // XXX: This should probably be handled more nicely.
    }
    const version = this.reader.readChars(3); // "89a"
    this.header = { signature, version };
  }
  parseLogicalScreenDescriptor() {
    const width = this.reader.readUnsigned();
    const height = this.reader.readUnsigned();
    const packetFields = this.reader.readByte();
    const backgroundColorIndex = this.reader.readByte();
    const pixelAspectRatio = this.reader.readByte();
    const [
      globalColorTableFlag, // 是否有全局颜色表
      colorResolution, // 表示颜色表中每种基色用多少位表示，比如 '111' 表示8位表示一种基色,则颜色表每项是 color_resolution*3位,一般不处理
      sorted, // 颜色表中是否重要颜色在前
      globalColorTableSize, // 全局颜色表 size
    ] = split8bit(packetFields, [1, 3, 1, 3]);
    const globalColorTable =
      globalColorTableFlag && globalColorTableSize
        ? this.parseColorTable(1 << (globalColorTableSize + 1))
        : undefined;
    Object.assign(this.header, {
      width,
      height,
      backgroundColorIndex,
      pixelAspectRatio,
      globalColorTableFlag,
      colorResolution,
      sorted,
      globalColorTableSize,
    });
    this.globalColorTable = globalColorTable || [];
  }
  async parseBlock() {
    const sentinel = this.reader.readByte();
    const char = String.fromCharCode(sentinel);
    switch (char) {
      case "!":
        this.parseExtension();
        break;
      case ",":
        await this.parseImg(); // 解析帧
        break;
      case ";":
        return;
      default:
        throw new Error("Unknown block: 0x" + sentinel.toString(16)); // TODO: Pad this with a 0.
    }
    return this.parseBlock();
  }
  /**
   * LZW (GIF-specific)
   * @param entries
   */
  parseColorTable(entries: number) {
    const colorTable: RGB[] = [];
    for (let i = entries - 1; i >= 0; i--) {
      colorTable.push(this.reader.readBytes(3) as RGB);
    }
    return colorTable;
  }
  parseExtension() {
    const label = this.reader.readByte();
    console.log(label.toString(16));
    switch (label) {
      case 0xf9:
        this.parseGraphicControlExtension();
        break;
      case 0xfe:
        this.parseCommentExtension();
        break;
      case 0x01:
        this.parsePlainTextExtension();
        break;
      case 0xff:
        this.parseApplicationExtension();
        break;
      default:
        this.parseUnknownExtension(label.toString(16));
        break;
    }
  }
  /**
   * 相当于注释，仅在89a版本存在
   * [0x21, 0xfe,注释:subBlock, 0x00]
   */
  parseCommentExtension() {
    const blockSize = this.reader.readByte();
    const comment = this.reader.readBytes(blockSize);
    const terminator = this.reader.readByte(); // 0x00
  }

  /**
   * 纯文本扩展名, 仅89a存在
   *
   * No one *ever* uses this. If you use it, deal with parsing it yourself.
   *
   * [0x21, 0x01, plain_text_control_info:subBlock, plain_text_data:subBlock, 0x00]
   */
  parsePlainTextExtension() {
    const blockSize = this.reader.readByte(); // 固定 12
    const ptHeader = this.reader.readBytes(blockSize);
    const ptData = this.reader.readSubBlocks();
  }

  /**
   * 应用程序扩展, 无作用域，不被修改
   *
   * [0x21, 0xff, [size:0x11, identifier:B{8}, authCode{3}], appData:subBlock, 0x00]
   */
  parseApplicationExtension() {
    const parseAppData = (identifier: string, appData: string) => {
      console.log("parseAppData", identifier, appData);
    };
    const blockSize = this.reader.readByte(); // Always 11
    const identifier: string = this.reader.readChars(8); // 应用程序标识符 'NETSCAPE'|'        '
    const authCode = this.reader.readChars(3); // 应用程序验证码
    const appDataSize = this.reader.readByte();
    const appData = this.reader.readChars(appDataSize);
    const terminator = this.reader.readByte();
    parseAppData(identifier, appData);
  }

  parseUnknownExtension(label: string) {
    const data = this.reader.readSubBlocks();
    const terminator = this.reader.readByte();
    throw new Error(`unknown {label:${label},data: "${data}" }`);
  }
  /**
   * 图形扩展块，范围是紧随其后的渲染块
   * [0x21, 0xf9, [0x04, packetFields:B, delayTime:BB, transparencyIndex:B], 0x00]
   */
  parseGraphicControlExtension() {
    const [
      blockSize, // 固定0x04，意思是后面有4个Byte
      packetFields,
      delayTime, // 单位10毫秒
      transparencyIndex, // 透明度指数0x00~0xff，仅当transparencyGiven为true时存在
      terminator, // 块终止符，固定0x00
    ] = [
        this.reader.readByte(), // Always 0x04
        this.reader.readByte(),
        this.reader.readUnsigned(),
        this.reader.readByte(),
        this.reader.readByte(),
      ];
    const [
      reserved, // 保留
      disposalMethod, // 处理方法：{0:'无处置方法',1:'请勿丢弃，该帧将被保留在画板',2:'恢复为背景色',3:'恢复到上一个'}
      userInputFlag, // 用户输入标志，是true时delayTime以收到用户输入或delayTime先到为准
      transparencyGiven, // 是否给出透明度索引transparencyIndex
    ] = split8bit(packetFields, [3, 3, 1, 1]);
    this.graphicControl = {
      delayTime: delayTime * 10,
      transparency: transparencyGiven
        ? transparencyIndex
        : DEFAULT_TRANSPARENCY,
      disposalMethod,
      userInputFlag: !!userInputFlag,
    };
  }
  parseImg() {
    console.log("parseImg", this.frames.length);
    const [
      left,
      top,
      width,
      height,
      packetFields,
      lzwMinCodeSize, // 一个像素索引值所用的最少比特数，如 0x08表示解码后每个像素索引值是8位 '11111111'
      lzwData,
    ] = [
        this.reader.readUnsigned(),
        this.reader.readUnsigned(),
        this.reader.readUnsigned(),
        this.reader.readUnsigned(),
        this.reader.readByte(),
        this.reader.readByte(),
        this.reader.readSubBlocks(),
      ];

    const [
      localColorTableFlag, // 后面是否有local颜色表
      interlaced, // 是否错行，用来实现模糊变清晰的效果
      sorted, // 颜色表中是否重要颜色在前
      reserved, // 保留 无用
      lctSize, // 局部颜色表大小
    ] = split8bit(packetFields, [1, 1, 1, 2, 3]);

    const localColorTable: RGB[] | undefined = localColorTableFlag
      ? this.parseColorTable(1 << (lctSize + 1))
      : undefined; // 局部颜色表

    // lzw 串表压缩算法
    let pixels = lzwDecode(lzwMinCodeSize, lzwData);
    if (interlaced) {
      // 是否错行
      pixels = deinterlace(pixels, width);
    }
    const colorTable: RGB[] = localColorTable || this.globalColorTable;
    const data = new Uint8ClampedArray(pixels.length * 4);
    for (let i = pixels.length - 1; i >= 0; i -= 1) {
      const flag = i * 4;
      const rgb = colorTable[pixels[i]];
      data[flag + 0] = rgb[0]; // red
      data[flag + 1] = rgb[1]; // green
      data[flag + 2] = rgb[2]; // blue
      data[flag + 3] = this.graphicControl.transparency; // alpha
    }
    this.frames.push({
      delay: this.graphicControl.delayTime,
      left,
      top,
      data: new ImageData(data, width, height),
    });
  }
}
export class GIFPlayer {
  src: string;
  canvas = document.createElement("canvas");
  data?: ArrayBuffer;
  parser?: GIFParser;
  constructor(src: string) {
    this.src = src;
    this.loadSrc();
  }
  onDownloadProgress(e: ProgressEvent<XMLHttpRequest>) {
    console.log("onprogress", ((e.loaded / e.total) * 100).toFixed(2));
  }
  getCanvas() {
    return this.canvas;
  }
  async loadSrc() {
    const data = await this.download();
    if (data) {
      this.data = data;
      await this.parse();
    } else {
      console.error(`cannot download: ${this.src}`);
    }
  }
  async download() {
    try {
      const res = await axios.get(this.src, {
        responseType: "arraybuffer",
        onDownloadProgress: this.onDownloadProgress,
      });
      return res.data as ArrayBuffer;
      this.data = res.data as ArrayBuffer;
      this.parse();
    } catch (error) {
      console.log("onerror", error);
    }
  }
  async parse() {
    if (this.data) {
      this.parser = new GIFParser(this.data as ArrayBuffer, {
        onParsed: this.onParsed,
      });
    }
  }
  onHeader() { }
  onFrame() { }
  onParsed() { }
  play() { }
  pause() { }
}
/**
 * 材料： src canvas
 * 时间线
 *  - 开始请求src
 * - 下载完毕src
 * - 解析src开始
 * - 解析完第一帧开始播放 需要canvas
 * - 解析src完毕
 *
 *
 *
 */
