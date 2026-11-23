/**
 * Shrink an image in the browser and return it as a JPEG data URL.
 * Used only when Firebase Storage is not enabled, so product photos can still be saved
 * (inside the product record) instead of being blocked.
 */
export async function compressImageToDataUrl(
  file: File,
  { maxDimension = 900, maxBytes = 90_000 }: { maxDimension?: number; maxBytes?: number } = {},
): Promise<string> {
  const bitmap = await loadBitmap(file);
  let dimension = maxDimension;

  for (let attempt = 0; attempt < 6; attempt++) {
    const scale = Math.min(1, dimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Image processing is not supported in this browser.');
    ctx.fillStyle = '#ffffff'; // flatten transparency for JPEG
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);

    for (const quality of [0.82, 0.7, 0.58, 0.46]) {
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      // base64 is ~4/3 of the binary size
      if ((dataUrl.length * 3) / 4 <= maxBytes) return dataUrl;
    }
    dimension = Math.round(dimension * 0.78);
  }
  throw new Error('This image is too detailed to compress enough. Try a smaller image.');
}

async function loadBitmap(file: File): Promise<{ width: number; height: number } & CanvasImageSource> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      // fall through to <img> decoding
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img as unknown as { width: number; height: number } & CanvasImageSource;
  } finally {
    URL.revokeObjectURL(url);
  }
}
