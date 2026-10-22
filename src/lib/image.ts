const MAX_SIDE = 1600
const MAX_INPUT_BYTES = 25 * 1024 * 1024

export type PhotoErrorCode = 'notPhoto' | 'tooBig' | 'cantProcess' | 'cantOpen'
/** Carries a code; the UI turns it into words in the current language. */
export class PhotoError extends Error {
  constructor(public code: PhotoErrorCode) { super(code) }
}

/**
 * Downscale + re-encode photos before storing them, so a journal full of
 * phone pictures stays comfortably inside browser storage limits.
 */
export async function compressImage(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new PhotoError('notPhoto')
  if (file.size > MAX_INPUT_BYTES) throw new PhotoError('tooBig')
  let bitmap: ImageBitmap | HTMLImageElement
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    bitmap = await loadImg(file)
  }
  const w = 'naturalWidth' in bitmap ? bitmap.naturalWidth : bitmap.width
  const h = 'naturalHeight' in bitmap ? bitmap.naturalHeight : bitmap.height
  const scale = Math.min(1, MAX_SIDE / Math.max(w, h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w * scale)
  canvas.height = Math.round(h * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new PhotoError('cantProcess')
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  if ('close' in bitmap) bitmap.close()
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.85))
  if (!blob) throw new PhotoError('cantProcess')
  return blob
}

function loadImg(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new PhotoError('cantOpen')) }
    img.src = url
  })
}

export function blobToDataURL(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

export async function dataURLToBlob(url: string) {
  const res = await fetch(url)
  return res.blob()
}
