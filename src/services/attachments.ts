export const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024

const MAX_IMAGE_EDGE = 1920
const IMAGE_QUALITY = 0.82

function isImage(file: File) {
  return file.type.startsWith('image/') || /\.(avif|bmp|gif|heic|heif|jpe?g|png|tiff?|webp)$/i.test(file.name)
}

function isPdf(file: File) {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

export function validateAttachmentFiles(files: File[]) {
  for (const file of files) {
    if (!isImage(file) && !isPdf(file)) {
      throw new Error(`«${file.name}» no es una imagen ni un PDF.`)
    }
    if (file.size > MAX_ATTACHMENT_SIZE) {
      throw new Error(`«${file.name}» supera el límite de 5 MB por archivo.`)
    }
  }
}

function decodeImage(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; release: () => void }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => resolve({ source: image, width: image.naturalWidth, height: image.naturalHeight, release: () => URL.revokeObjectURL(url) })
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen.')) }
    image.src = url
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string) {
  return new Promise<Blob | null>(resolve => canvas.toBlob(resolve, type, IMAGE_QUALITY))
}

async function compressImage(file: File): Promise<File> {
  if (!isImage(file) || /\.(gif|svg)$/i.test(file.name) || file.type === 'image/svg+xml') return file

  let decoded: Awaited<ReturnType<typeof decodeImage>>
  try { decoded = await decodeImage(file) } catch { return file }

  try {
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(decoded.width, decoded.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(decoded.width * scale))
    canvas.height = Math.max(1, Math.round(decoded.height * scale))
    const context = canvas.getContext('2d')
    if (!context) return file
    context.drawImage(decoded.source, 0, 0, canvas.width, canvas.height)

    const preferredType = file.type === 'image/png' || file.type === 'image/webp' ? 'image/webp' : 'image/jpeg'
    const compressed = await canvasToBlob(canvas, preferredType)
    if (!compressed || compressed.size >= file.size) return file

    const extension = compressed.type === 'image/webp' ? 'webp' : compressed.type === 'image/png' ? 'png' : 'jpg'
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'adjunto'
    return new File([compressed], `${baseName}.${extension}`, { type: compressed.type, lastModified: file.lastModified })
  } catch {
    return file
  } finally {
    decoded.release()
  }
}

export async function prepareAttachmentFiles(files: File[]) {
  validateAttachmentFiles(files)
  const pdfCompressor = files.some(isPdf) ? await import('./compressPdf') : null
  const prepared: File[] = []
  for (const file of files) {
    prepared.push(isPdf(file) ? await pdfCompressor!.compressPdfFile(file) : await compressImage(file))
  }
  return prepared
}

export function attachmentErrorMessage(error: unknown) {
  if (error instanceof DOMException && error.name === 'QuotaExceededError') {
    return 'No hay espacio suficiente en este dispositivo. Borra adjuntos que ya no necesites o vacía la papelera e inténtalo de nuevo.'
  }
  return error instanceof Error ? error.message : 'No se pudieron guardar los adjuntos. Comprueba el espacio disponible e inténtalo de nuevo.'
}
