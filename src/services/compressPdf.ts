import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { jsPDF } from 'jspdf'

GlobalWorkerOptions.workerSrc = pdfWorkerUrl

function canvasJpeg(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<string>((resolve, reject) => {
    canvas.toBlob(async blob => {
      if (!blob) { reject(new Error('No se pudo preparar una página del PDF.')); return }
      try {
        const dataUrl = await new Promise<string>((readResolve, readReject) => {
          const reader = new FileReader()
          reader.onload = () => typeof reader.result === 'string' ? readResolve(reader.result) : readReject(new Error('No se pudo leer una página del PDF.'))
          reader.onerror = () => readReject(new Error('No se pudo leer una página del PDF.'))
          reader.readAsDataURL(blob)
        })
        resolve(dataUrl)
      } catch (error) { reject(error) }
    }, 'image/jpeg', quality)
  })
}

export async function compressPdfFile(file: File): Promise<File> {
  let document: PDFDocumentProxy | undefined
  let destroyLoadingTask: (() => Promise<void>) | undefined
  try {
    const loadingTask = getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
    destroyLoadingTask = () => loadingTask.destroy()
    document = await loadingTask.promise
    const qualityLevels = [0.68, 0.52, 0.38]
    const outputFiles: File[] = []

    for (const quality of qualityLevels) {
      const firstPage = await document.getPage(1)
      const firstViewport = firstPage.getViewport({ scale: 1 })
      const pdf = new jsPDF({ unit: 'pt', format: [firstViewport.width, firstViewport.height], orientation: firstViewport.width > firstViewport.height ? 'landscape' : 'portrait', compress: true })

      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
        const page = pageNumber === 1 ? firstPage : await document.getPage(pageNumber)
        const pageSize = page.getViewport({ scale: 1 })
        const viewport = page.getViewport({ scale: 1.5 })
        const canvas = window.document.createElement('canvas')
        canvas.width = Math.ceil(viewport.width)
        canvas.height = Math.ceil(viewport.height)
        const context = canvas.getContext('2d', { alpha: false })
        if (!context) throw new Error('El navegador no pudo preparar el PDF.')
        context.fillStyle = '#fff'
        context.fillRect(0, 0, canvas.width, canvas.height)
        await page.render({ canvas, viewport }).promise
        const image = await canvasJpeg(canvas, quality)
        if (pageNumber > 1) pdf.addPage([pageSize.width, pageSize.height], pageSize.width > pageSize.height ? 'landscape' : 'portrait')
        pdf.addImage(image, 'JPEG', 0, 0, pageSize.width, pageSize.height, undefined, 'FAST')
        canvas.width = 0
        canvas.height = 0
        page.cleanup()
      }

      const blob = pdf.output('blob')
      const compressed = new File([blob], file.name, { type: 'application/pdf', lastModified: file.lastModified })
      if (compressed.size < file.size) outputFiles.push(compressed)
      if (compressed.size <= file.size * 0.6) return compressed
    }

    return outputFiles.sort((a, b) => a.size - b.size)[0] || file
  } catch {
    return file
  } finally {
    try { await destroyLoadingTask?.() } catch { /* Keep the original/compressed file result. */ }
  }
}
