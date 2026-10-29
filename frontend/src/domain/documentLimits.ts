/** Shared frontend policy for original PDFs and application-level page totals. */
export const MAX_PDF_BYTES = 20 * 1024 * 1024
export const MAX_DOCUMENT_PAGES = 100
export const MAX_APPLICATION_PAGES = 100

export function isValidPdfSize(sizeBytes: number): boolean {
  return Number.isInteger(sizeBytes) && sizeBytes > 0 && sizeBytes <= MAX_PDF_BYTES
}

export function isValidDocumentPageCount(pageCount: number): boolean {
  return Number.isInteger(pageCount) && pageCount > 0 && pageCount <= MAX_DOCUMENT_PAGES
}

/** An empty draft is within the limit; requiring documents belongs to the caller. */
export function isWithinApplicationPageLimit(totalPages: number): boolean {
  return Number.isInteger(totalPages) && totalPages >= 0 && totalPages <= MAX_APPLICATION_PAGES
}
