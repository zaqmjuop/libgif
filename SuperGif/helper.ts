export const toBinary = (num: number) => num.toString(2).padStart(8, "0");
// lzw 串表压缩算法
export function lzwDecode(minCodeSize: number, data: string) {
  // data 就是帧图片
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;
  let output: number[] = [];
  let pos = 0; // Maybe this streaming thing should be merged with the Stream?
  let dict: Array<number[]> = [];
  let codeSize: number = minCodeSize + 1;
  let code: number = 0;
  function readCode(size: number) {
    let code = 0;
    for (let i = 0; i < size; i++) {
      if (data.charCodeAt(pos >> 3) & (1 << (pos & 7))) {
        code |= 1 << i;
      }
      pos++;
    }
    return code;
  }
  function clear() {
    codeSize = minCodeSize + 1;
    if (dict.length <= eoiCode + 1) {
      dict = [];
      for (let i = clearCode - 1; i >= 0; i--) {
        dict[i] = [i];
      }
      dict[clearCode] = [];
      dict[eoiCode] = [];
    } else {
      dict = dict.slice(0, eoiCode + 1);
    }
  }
  let prevCode: number;
  while (true) {
    // console.log('code', code)
    prevCode = code;
    code = readCode(codeSize);
    if (code === clearCode) {
      clear();
      continue;
    } else if (code === eoiCode) {
      break;
    } else if (code > dict.length) {
      throw new Error("Invalid LZW code.");
    } else if (code === dict.length) {
      dict.push(dict[prevCode].concat(dict[prevCode][0]));
    } else if (prevCode !== clearCode) {
      dict.push(dict[prevCode].concat(dict[code][0]));
    }

    output.push(...dict[code]);

    if (dict.length === 1 << codeSize && codeSize < 12) {
      // If we're at the prevCode code and codeSize is 12, the next code will be a clearCode, and it'll be 12 bits long.
      codeSize++;
    }
  }

  // I don't know if this is technically an error, but some GIFs do it.
  //if (Math.ceil(pos / 8) !== data.length) throw new Error('Extraneous LZW bytes.');
  // throw new Error("第一帧结束");
  return output;
}
export function drawError(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "red";
  ctx.lineWidth = 3;
  ctx.moveTo(0, 0);
  ctx.lineTo(width, height);
  ctx.moveTo(width, 0);
  ctx.lineTo(0, height);
  ctx.stroke();
}
// See appendix E.
const INTERLACE = [
  { offset: 0, step: 8 }, // 0,8,16,24...rowLength
  { offset: 4, step: 8 }, // 4,12,20,28...rowLength
  { offset: 2, step: 4 }, // 2,6,10,14,18,22,...rowLength
  { offset: 1, step: 2 }, // 1,3,5,7,9,11,13,15,17,19,21...rowLength
];
export function deinterlace(pixels: number[], width: number) {
  // Of course this defeats the purpose of interlacing. And it's *probably*
  // the least efficient way it's ever been implemented. But nevertheless...
  const newPixels: number[] = new Array(pixels.length);
  const rowLength = pixels.length / width;
  function cpRow(toRow: number, fromRow: number) {
    const toStart = toRow * width;
    const fromStart = fromRow * width;
    for (let i = width - 1; i >= 0; i--) {
      newPixels[toStart + i] = pixels[fromStart + i];
    }
  }
  let fromRow = 0;
  for (let i = INTERLACE.length - 1; i >= 0; i--) {
    for (let toRow = INTERLACE[i].offset; toRow < rowLength; toRow += INTERLACE[i].step) {
      cpRow(toRow, fromRow);
      fromRow++;
    }
  }
  return newPixels;
}
