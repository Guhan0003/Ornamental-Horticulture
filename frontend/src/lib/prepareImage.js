/**
 * Shrink a photo in the browser before uploading it.
 *
 * The API is a Vercel function, and Vercel refuses any request body over
 * ~4.5MB before it reaches our code, so a phone photo straight from the
 * camera (5–10MB) never arrives. Resizing here keeps uploads well under that
 * and makes them far quicker on mobile data. The server still does its own
 * resize and WebP conversion — this only makes sure the file gets there.
 */

// Comfortably below Vercel's limit, leaving room for the multipart wrapper.
export const MAX_UPLOAD_BYTES = 3.5 * 1024 * 1024

// Bigger than the server's IMAGE_MAX_DIMENSION (1600), so it stays the one
// deciding final quality; this is only a ceiling for the transfer.
const MAX_DIMENSION = 2400

const QUALITY_STEPS = [0.85, 0.72, 0.6]

const canEncode = (type) => {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  return canvas.toDataURL(type).startsWith(`data:${type}`)
}

const toBlob = (canvas, type, quality) =>
  new Promise((resolve) => canvas.toBlob(resolve, type, quality))

/**
 * Returns a File small enough to upload, or the original when it already is.
 * Throws only if the image can't be read at all.
 */
export async function prepareImage(file) {
  if (file.size <= MAX_UPLOAD_BYTES) return file

  // 'from-image' applies the EXIF rotation, so a portrait phone photo doesn't
  // come out sideways once the orientation tag is dropped.
  let bitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    // An unreadable or unsupported format (HEIC on some browsers): send it as
    // it is and let the server or the size check report the problem.
    return file
  }

  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)

  const context = canvas.getContext('2d')
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close?.()

  const type = canEncode('image/webp') ? 'image/webp' : 'image/jpeg'
  const extension = type === 'image/webp' ? '.webp' : '.jpg'
  const name = file.name.replace(/\.[^.]+$/, '') + extension

  let smallest = null
  for (const quality of QUALITY_STEPS) {
    const blob = await toBlob(canvas, type, quality)
    if (!blob) break
    if (!smallest || blob.size < smallest.size) smallest = blob
    if (blob.size <= MAX_UPLOAD_BYTES) break
  }

  if (!smallest) return file
  return new File([smallest], name, { type, lastModified: file.lastModified })
}
