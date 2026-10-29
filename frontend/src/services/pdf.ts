import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import {
  isValidDocumentPageCount,
  isValidPdfSize,
  MAX_DOCUMENT_PAGES,
  MAX_PDF_BYTES,
} from '../domain/documentLimits'
GlobalWorkerOptions.workerSrc = workerUrl
export const MAX_FILE_SIZE = MAX_PDF_BYTES
export const MAX_PAGES = MAX_DOCUMENT_PAGES
export async function openPdf(blob: Blob): Promise<PDFDocumentProxy> {
  const data = await blob.arrayBuffer()
  const task = getDocument({ data, useSystemFonts: true })
  try {
    return await task.promise
  } catch (error) {
    try {
      await task.destroy()
    } catch {
      /* Preserve the original parsing error if worker cleanup also fails. */
    }
    throw error
  }
}
export async function inspectPdf(file: File) {
  if (!file.name.toLowerCase().endsWith('.pdf') || (file.type && file.type !== 'application/pdf'))
    throw new Error('Only PDF documents are supported.')
  if (!isValidPdfSize(file.size))
    throw new Error('Each PDF must be non-empty and no larger than 20 MB.')
  let document: PDFDocumentProxy | undefined
  try {
    document = await openPdf(file)
    if (!isValidDocumentPageCount(document.numPages))
      throw new Error('An application cannot contain more than 100 pages.')
    return { pages: document.numPages }
  } catch (error) {
    if (error instanceof Error && error.message.includes('100 pages')) throw error
    throw new Error('This PDF cannot be read. Check that it is valid and not password-protected.', {
      cause: error,
    })
  } finally {
    await document?.loadingTask.destroy()
  }
}
