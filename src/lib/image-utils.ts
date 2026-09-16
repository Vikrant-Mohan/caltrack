/**
 * Image helpers for meal-photo capture: every photo is downscaled to at most
 * 1024px on its longest edge and re-encoded as JPEG q≈0.8 before being sent
 * to the AI provider (smaller uploads, faster analysis).
 */

const MAX_EDGE = 1024;
const JPEG_QUALITY = 0.8;

/** Draw an image source onto a canvas, scaled to fit within MAX_EDGE. */
function drawScaled(source: CanvasImageSource, w: number, h: number): HTMLCanvasElement {
  const scale = Math.min(1, MAX_EDGE / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported in this browser.");
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Base64 (no data: prefix) of a canvas rendered as JPEG. */
function canvasToBase64Jpeg(canvas: HTMLCanvasElement): string {
  const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  return dataUrl.slice(dataUrl.indexOf(",") + 1);
}

/**
 * Grab the current frame of a live camera <video> element as base64 JPEG.
 * Throws if the video has no frame yet (not playing).
 */
export function videoFrameToBase64Jpeg(video: HTMLVideoElement): string {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) throw new Error("Camera is not ready yet — try again.");
  return canvasToBase64Jpeg(drawScaled(video, w, h));
}

/**
 * Downscale a user-chosen File (gallery photo / camera capture fallback) to
 * base64 JPEG. Rejects when the file cannot be decoded as an image.
 */
export function fileToBase64Jpeg(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        resolve(canvasToBase64Jpeg(drawScaled(img, img.naturalWidth, img.naturalHeight)));
      } catch (err) {
        reject(err instanceof Error ? err : new Error("Could not process image."));
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image file."));
    };
    img.src = url;
  });
}
