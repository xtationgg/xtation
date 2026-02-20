const THUMB_MAX_DIMENSION = 256;
const THUMB_MAX_BYTES = 80 * 1024;

const createCanvas = (width: number, height: number) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

const blobFromCanvas = (canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to render thumbnail blob'));
          return;
        }
        resolve(blob);
      },
      type,
      quality
    );
  });

const drawContain = (
  ctx: CanvasRenderingContext2D,
  sourceWidth: number,
  sourceHeight: number,
  draw: (dx: number, dy: number, dw: number, dh: number) => void
) => {
  const ratio = Math.min(THUMB_MAX_DIMENSION / sourceWidth, THUMB_MAX_DIMENSION / sourceHeight);
  const width = Math.max(1, Math.round(sourceWidth * ratio));
  const height = Math.max(1, Math.round(sourceHeight * ratio));
  const x = Math.floor((THUMB_MAX_DIMENSION - width) / 2);
  const y = Math.floor((THUMB_MAX_DIMENSION - height) / 2);
  draw(x, y, width, height);
};

const compressCanvas = async (canvas: HTMLCanvasElement): Promise<Blob> => {
  const qualities = [0.82, 0.75, 0.65, 0.55, 0.45];
  for (const quality of qualities) {
    const blob = await blobFromCanvas(canvas, 'image/webp', quality);
    if (blob.size <= THUMB_MAX_BYTES) return blob;
  }
  const fallback = await blobFromCanvas(canvas, 'image/jpeg', 0.6);
  return fallback;
};

const createPlaceholderCanvas = (label = 'FILE') => {
  const canvas = createCanvas(THUMB_MAX_DIMENSION, THUMB_MAX_DIMENSION);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const grad = ctx.createLinearGradient(0, 0, THUMB_MAX_DIMENSION, THUMB_MAX_DIMENSION);
  grad.addColorStop(0, '#191c25');
  grad.addColorStop(1, '#0f1118');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, THUMB_MAX_DIMENSION, THUMB_MAX_DIMENSION);

  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 2;
  ctx.strokeRect(20, 20, THUMB_MAX_DIMENSION - 40, THUMB_MAX_DIMENSION - 40);

  ctx.fillStyle = 'rgba(255,255,255,0.72)';
  ctx.font = '700 20px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label.slice(0, 10).toUpperCase(), THUMB_MAX_DIMENSION / 2, THUMB_MAX_DIMENSION / 2);
  return canvas;
};

const makeImageThumbnail = async (file: File): Promise<Blob> => {
  const imageBitmap = await createImageBitmap(file);
  const canvas = createCanvas(THUMB_MAX_DIMENSION, THUMB_MAX_DIMENSION);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context not available for image thumbnail');

  ctx.fillStyle = '#11141b';
  ctx.fillRect(0, 0, THUMB_MAX_DIMENSION, THUMB_MAX_DIMENSION);
  drawContain(ctx, imageBitmap.width, imageBitmap.height, (dx, dy, dw, dh) => {
    ctx.drawImage(imageBitmap, dx, dy, dw, dh);
  });

  return compressCanvas(canvas);
};

const captureVideoFrame = (file: File): Promise<HTMLCanvasElement> =>
  new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    let settled = false;

    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.pause();
      video.removeAttribute('src');
      video.load();
    };

    const fail = (reason: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(reason));
    };

    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.src = url;

    const handleLoaded = async () => {
      try {
        // Seek slightly forward for non-black first frame when possible.
        if (Number.isFinite(video.duration) && video.duration > 0.25) {
          await new Promise<void>((resolveSeek) => {
            const onSeeked = () => {
              video.removeEventListener('seeked', onSeeked);
              resolveSeek();
            };
            video.addEventListener('seeked', onSeeked);
            video.currentTime = Math.min(0.12, Math.max(video.duration - 0.05, 0));
          });
        }

        const width = Math.max(1, Math.round(video.videoWidth || THUMB_MAX_DIMENSION));
        const height = Math.max(1, Math.round(video.videoHeight || THUMB_MAX_DIMENSION));
        const canvas = createCanvas(THUMB_MAX_DIMENSION, THUMB_MAX_DIMENSION);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas context not available for video thumbnail');
        ctx.fillStyle = '#0f1118';
        ctx.fillRect(0, 0, THUMB_MAX_DIMENSION, THUMB_MAX_DIMENSION);
        drawContain(ctx, width, height, (dx, dy, dw, dh) => {
          ctx.drawImage(video, dx, dy, dw, dh);
        });

        if (!settled) {
          settled = true;
          cleanup();
          resolve(canvas);
        }
      } catch (err) {
        fail((err as Error).message || 'Failed to capture video thumbnail');
      }
    };

    video.addEventListener('loadeddata', handleLoaded);
    video.addEventListener('error', () => fail('Unable to load video for thumbnail'));
  });

const makeVideoThumbnail = async (file: File): Promise<Blob> => {
  const canvas = await captureVideoFrame(file);
  return compressCanvas(canvas);
};

export const makePlaceholderThumbnail = async (label = 'FILE'): Promise<Blob> => {
  const canvas = createPlaceholderCanvas(label);
  return compressCanvas(canvas);
};

export const makeThumbnail = async (file: File): Promise<Blob> => {
  const mime = (file.type || '').toLowerCase();
  try {
    if (mime.startsWith('image/')) {
      return await makeImageThumbnail(file);
    }
    if (mime.startsWith('video/')) {
      return await makeVideoThumbnail(file);
    }
    return await makePlaceholderThumbnail('FILE');
  } catch {
    return makePlaceholderThumbnail(mime.startsWith('video/') ? 'VIDEO' : 'FILE');
  }
};

