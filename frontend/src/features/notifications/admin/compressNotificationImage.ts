export const MAX_NOTIFICATION_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 1600;

/** Match the server's JPEG/white-background output while keeping large uploads under its limit. */
export async function compressNotificationImage(file: File, signal: AbortSignal): Promise<File> {
  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      const cancel = () => { image.src = ''; reject(new DOMException('Image processing cancelled.', 'AbortError')); };
      if (signal.aborted) return cancel();
      signal.addEventListener('abort', cancel, {once:true});
      image.onload = () => { signal.removeEventListener('abort', cancel); resolve(); };
      image.onerror = () => { signal.removeEventListener('abort', cancel); reject(new Error('Could not read this image. Choose another JPG, PNG, or WebP image.')); };
      image.src = objectUrl;
    });
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('Could not read this image. Choose another image.');
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('This browser could not process the image. Choose an image under 5 MB.');
    let scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
    for (let attempt = 0; attempt < 5; attempt++) {
      if (signal.aborted) throw new DOMException('Image processing cancelled.', 'AbortError');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const quality = Math.max(0.7, 0.92 - attempt * 0.06);
      const blob = await new Promise<Blob|null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (signal.aborted) throw new DOMException('Image processing cancelled.', 'AbortError');
      if (!blob || blob.type !== 'image/jpeg') throw new Error('This browser could not compress the image. Choose an image under 5 MB.');
      if (blob.size <= MAX_NOTIFICATION_IMAGE_BYTES) {
        const name = `${file.name.replace(/\.[^.]+$/, '') || 'notification-image'}.jpg`;
        return new File([blob], name, {type:'image/jpeg',lastModified:file.lastModified});
      }
      scale *= 0.8;
    }
    throw new Error('This image could not be compressed below 5 MB. Choose a smaller image.');
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
