import { newId, type Photo } from '../types/report';

export const MAX_PHOTOS_PER_GROUP = 8;
export const MAX_SOURCE_IMAGE_BYTES = 25 * 1024 * 1024; // 25 MB per original file
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.8;

/** Resize + re-encode an uploaded image as a compressed JPEG data URL, entirely in the browser. */
export async function fileToPhoto(file: File): Promise<Photo> {
  if (!file.type.startsWith('image/')) throw new Error(`"${file.name}" is not an image file.`);
  if (file.size > MAX_SOURCE_IMAGE_BYTES) throw new Error(`"${file.name}" is larger than 25 MB.`);
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error(`"${file.name}" could not be read as an image.`));
      el.src = url;
    });
    const scale = Math.min(1, MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Your browser could not process the image.');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    return { id: newId(), dataUrl: canvas.toDataURL('image/jpeg', JPEG_QUALITY), caption: '', width, height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Approximate decoded size of a set of data URLs, in bytes. */
export function photosSize(photos: Photo[]): number {
  return photos.reduce((n, p) => n + Math.round((p.dataUrl.length * 3) / 4), 0);
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
