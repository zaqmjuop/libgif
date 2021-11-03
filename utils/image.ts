export function canvasToBlob(canvas: HTMLCanvasElement, quality = 1): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
  });
}
