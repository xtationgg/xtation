export const readFileAsDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
};

/**
 * Read an image file and downscale/compress to reduce memory + localStorage usage.
 * Defaults are tuned for avatars/gallery.
 */
export const readImageCompressedDataUrl = async (
  file: File,
  opts: { maxSize?: number; quality?: number; mimeType?: 'image/jpeg' | 'image/webp' } = {}
): Promise<string> => {
  const maxSize = opts.maxSize ?? 768;
  const quality = opts.quality ?? 0.85;
  const mimeType = opts.mimeType ?? 'image/jpeg';

  const original = await readFileAsDataUrl(file);

  // If it isn't an image, just return it
  if (!original.startsWith('data:image/')) return original;

  const img = new Image();
  img.src = original;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Image decode failed'));
  });

  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const scale = Math.min(1, maxSize / Math.max(w, h));
  const tw = Math.max(1, Math.round(w * scale));
  const th = Math.max(1, Math.round(h * scale));

  const canvas = document.createElement('canvas');
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext('2d');
  if (!ctx) return original;

  ctx.drawImage(img, 0, 0, tw, th);
  try {
    return canvas.toDataURL(mimeType, quality);
  } catch {
    // Some browsers may fail webp/jpeg conversion
    return original;
  }
};
