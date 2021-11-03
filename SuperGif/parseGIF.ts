import { header, RGB } from "./type";
import Stream from "./stream";
import { lzwDecode, toBinary, deinterlace } from "./helper";
window.debugstop = 0
const parseGIF = (st: Stream, handler: header) => {
  // LZW (GIF-specific)
  const parseColorTable = (entries: number) => {
    const colorTable: RGB[] = [];
    for (let i = entries - 1; i >= 0; i--) {
      colorTable.push(st.readBytes(3) as RGB);
    }
    return colorTable;
  };

  const readSubBlocks = () => st.readCharsBlocks();

  const parseExt = () => {
    console.log("parseExt", st.index);
    const parseGCExt = () => {
      console.log("parseGCExt", st.index);
      const blockSize = st.readByte(); // Always 4
      const byteBinary = toBinary(st.readByte());
      const reserved = byteBinary.slice(0, 3);
      const disposalMethod: number = parseInt(byteBinary.slice(3, 6), 2);
      const userInput = !!parseInt(byteBinary[6], 2);
      const transparencyGiven: boolean = !!parseInt(byteBinary[7], 2);
      const delayTime = st.readUnsigned();
      const transparencyIndex = st.readByte();
      const terminator = st.readByte();
      handler.gce &&
        handler.gce({
          delayTime,
          disposalMethod,
          transparencyGiven,
          transparencyIndex,
        });
    };

    const parseComExt = () => {
      console.log("parseComExt", st.index);
      const comment = readSubBlocks();
      handler.com && handler.com(0);
    };

    const parsePTExt = () => {
      console.log("parsePTExt", st.index);
      // No one *ever* uses this. If you use it, deal with parsing it yourself.
      const blockSize = st.readByte(); // Always 12
      const ptHeader = st.readBytes(blockSize);
      const ptData = readSubBlocks();
      handler.pte && handler.pte({ ptHeader, ptData });
    };

    const parseAppExt = () => {
      console.log("parseAppExt", st.index);
      const parseNetscapeExt = () => {
        console.log("parseNetscapeExt", st.index);
        const blockSize = st.readByte(); // Always 3
        const unknown = st.readByte(); // ??? Always 1? What is this?
        const iterations = st.readUnsigned();
        const terminator = st.readByte();
        handler.app && handler.app.NETSCAPE && handler.app.NETSCAPE(false);
      };

      const parseUnknownAppExt = ({ identifier }: { identifier: string }) => {
        console.log("parseUnknownAppExt", st.index);
        const appData = readSubBlocks();
        // FIXME: This won't work if a handler wants to match on any identifier.
        identifier && handler.app && handler.app[identifier] && handler.app[identifier]({ appData });
      };

      const blockSize = st.readByte(); // Always 11
      const identifier: string = st.readChars(8);
      const authCode = st.readChars(3);
      switch (identifier) {
        case "NETSCAPE":
          parseNetscapeExt();
          break;
        default:
          parseUnknownAppExt({ identifier });
          break;
      }
    };

    const parseUnknownExt = () => {
      console.log("parseUnknownExt", st.index);
      const data = readSubBlocks();
      handler.unknown && handler.unknown({ data });
    };

    const label = st.readByte();
    switch (label) {
      case 0xf9:
        parseGCExt();
        break;
      case 0xfe:
        parseComExt();
        break;
      case 0x01:
        parsePTExt();
        break;
      case 0xff:
        parseAppExt();
        break;
      default:
        parseUnknownExt();
        break;
    }
  };

  const parseImg = () => {
    console.log("parseImg", st.index);
    const [leftPos, topPos, width, height] = [
      st.readUnsigned(),
      st.readUnsigned(),
      st.readUnsigned(),
      st.readUnsigned(),
    ];
    const byteBinary = toBinary(st.readByte());
    const lctFlag = !!parseInt(byteBinary[0], 2);
    const interlaced = !!parseInt(byteBinary[1], 2);
    const sorted = !!parseInt(byteBinary[2], 2);
    const reserved = byteBinary.slice(3, 5);
    const lctSize = parseInt(byteBinary.slice(5, 8), 2);

    const lct = lctFlag ? parseColorTable(1 << (lctSize + 1)) : undefined;
    const [lzwMinCodeSize, lzwData] = [st.readByte(), readSubBlocks()];
    // lzw 串表压缩算法
    let pixels = lzwDecode(lzwMinCodeSize, lzwData);
    if (interlaced) {
      pixels = deinterlace(pixels, width);
    }

    handler.img &&
      handler.img({
        leftPos,
        topPos,
        width,
        height,
        pixels,
        lctFlag,
        lct,
      });
  };

  const parseBlock = () => {
    window.debugstop++
    console.log("parseBlock", st.index);
    const sentinel = st.readByte();
    const char = String.fromCharCode(sentinel); // For ease of matching
    console.log(`%c${char}`, 'color: blue;',st.index)
    switch (char) {
      case ";":
        return handler.eof && handler.eof(0);
      case "!":
        parseExt();
        break;
      case ",":
        parseImg(); // 解析帧
        break;
      default:
        throw new Error("Unknown block: 0x" + sentinel.toString(16)); // TODO: Pad this with a 0.
    }
    setTimeout(() => parseBlock());
  };

  const parseHeader = () => {
    const sig = st.readChars(3); // "GIF"
    if (sig !== "GIF") {
      throw new Error("Not a GIF file."); // XXX: This should probably be handled more nicely.
    }
    const ver = st.readChars(3); // "89a"
    const width = st.readUnsigned(); // 314
    const height = st.readUnsigned(); // 351
    const byteBinary = toBinary(st.readByte());
    const gctFlag = !!parseInt(byteBinary[0], 2);
    const colorRes = parseInt(byteBinary.slice(1, 4), 2);
    const sorted = !!parseInt(byteBinary[4], 2);
    const gctSize = parseInt(byteBinary.slice(5, 8), 2);
    const bgColor = st.readByte();
    const pixelAspectRatio = st.readByte(); // if not 0, aspectRatio = (pixelAspectRatio + 15) / 64
    const gct = gctFlag && gctSize ? parseColorTable(1 << (gctSize + 1)) : undefined;
    console.log("parseHeader", st.index);
    handler.hdr && handler.hdr({ width, height, gct, pixelAspectRatio });
  };

  const parse = () => {
    console.log("parse", st.index);
    try {
      parseHeader();
    } catch (error) {
      console.error(error);
    }
    setTimeout(() => parseBlock());
  };

  parse();
};
export default parseGIF;
