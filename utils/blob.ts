/**
 * Blob => dataURL
 * dataURL => canvas
 * canvas => Blob
 * canvas => dataURL
 * dataurl => Blob
 *
 * @todo ImageData
 * @todo 截图用 API putImageData drawImage
 * @todo 压缩用 API toBlob toDataURL
 */

export function blobToDataURL(blob: Blob): Promise<string | ArrayBuffer | null> {
  const fr = new FileReader();
  fr.readAsDataURL(blob);
  return new Promise((resolve) => {
    fr.onload = (e) => {
      resolve(e.target ? e.target.result : null);
    };
  });
}

export function blobToUrl(blob: Blob): string {
  return window.URL.createObjectURL(blob);
}

export function srcToImg(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = src;
  return new Promise((resolve) => {
    img.onload = (e) => {
      resolve(img);
    };
  });
}

export function sourceToCanvas(source: string | ImageData): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  let promise: Promise<unknown> = Promise.resolve();
  if (ctx) {
    if (source instanceof ImageData) {
      canvas.setAttribute("width", `${source.width}px`);
      canvas.setAttribute("height", `${source.height}px`);
      promise = Promise.resolve().then(() => ctx.putImageData(source, 0, 0));
    } else {
      promise = srcToImg(source).then((img) => {
        canvas.setAttribute("width", `${img.width}px`);
        canvas.setAttribute("height", `${img.height}px`);
        return ctx.drawImage(img, 0, 0);
      });
    }
  }
  return promise.then(() => canvas);
}

type cropRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};
// source:string|ImageData, top, left, width, height
export function cropImageByImageElement(img: HTMLImageElement, rect: cropRect): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("width", `${rect.width}px`);
  canvas.setAttribute("height", `${rect.height}px`);
  const ctx = canvas.getContext("2d");
  let promise: Promise<unknown> = Promise.resolve();
  if (ctx) {
    promise = promise.then(() =>
      ctx.drawImage(img, rect.left, rect.top, rect.width, rect.height, 0, 0, rect.width, rect.height)
    );
  }
  return promise.then(() => canvas);
}

export function cropImageByImageData(imageData: ImageData, rect: cropRect) {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("width", `${imageData.width}px`);
  canvas.setAttribute("height", `${imageData.height}px`);
  const ctx = canvas.getContext("2d");
  let promise: Promise<unknown> = Promise.resolve();
  if (ctx) {
    promise = promise.then(() => ctx.putImageData(imageData, 0, 0, rect.left, rect.top, rect.width, rect.height));
  }
  return promise.then(() => canvas);
}

export function cropByCanvas(canvas: HTMLCanvasElement, rect: cropRect) {
  const ctx = canvas.getContext("2d");
  if (ctx) {
    return ctx.getImageData(rect.left, rect.top, rect.width, rect.height);
  }
}

export function cropImageData(imageData: ImageData, rect: cropRect) {
  const data = new Uint8ClampedArray(rect.width * rect.height * 4);
  let di = 0;
  for (let y = rect.top; y < rect.top + rect.height; y++) {
    for (let x = rect.left; x < rect.left + rect.width; x++) {
      const index = y * 4 * imageData.width + x * 4;
      data[di] = imageData.data[index];
      data[di + 1] = imageData.data[index + 1];
      data[di + 2] = imageData.data[index + 2];
      data[di + 3] = imageData.data[index + 3];
      di += 4;
    }
  }
  return new ImageData(data, rect.width, rect.height);
}

export function canvasToBlob(canvas: HTMLCanvasElement, quality = 1): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality));
}

export function canvasToDataURL(canvas: HTMLCanvasElement, quality = 1) {
  return canvas.toDataURL("image/jpeg", quality);
}

export function dataurlToBlob(dataurl: string): Blob {
  const [prefix, mime, encodeType, data] = dataurl.split(/[:;,]/); // ["data", "image/jpeg", "base64", "/9j/4AAQSkZJRgA..."]
  const byteString = encodeType === "base64" ? atob(data) : unescape(data);
  // write the bytes of the string to a typed array
  const unit8Array = new Uint8Array(byteString.length);
  for (let index = 0; index < byteString.length; index++) {
    unit8Array[index] = byteString.charCodeAt(index);
  }

  return new Blob([unit8Array], { type: mime });
}
