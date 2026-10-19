import { useContent } from '../../hooks/useContent'
import { Box, Typography } from '@mui/material'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import { useEffect, useRef, useState } from 'react'
import { errorMessage } from '../../app/api'
import { type DocumentRecord } from '../../domain/types'
import { authorizedFile } from '../../services/demo'
import { ErrorNotice } from '../common'

export function PdfViewer({
  document,
  page,
  userId,
}: {
  document: DocumentRecord
  page: number
  userId: string | null
}) {
  const content = useContent('pdfViewer')
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  const [error, setError] = useState('')
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [width, setWidth] = useState(600)
  const canvas = useRef<HTMLCanvasElement>(null)
  const container = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let cancelled = false
    let loaded: PDFDocumentProxy | undefined
    void authorizedFile(document.id, userId)
      .then(async (file) => (await import('../../services/pdf')).openPdf(file))
      .then((value) => {
        loaded = value
        if (cancelled) void value.loadingTask.destroy()
        else setPdf(value)
      })
      .catch((error) => {
        if (!cancelled) {
          setError(errorMessage(error))
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
      void loaded?.loadingTask.destroy()
    }
  }, [document.id, userId])
  useEffect(() => {
    const element = container.current
    if (!element) return
    const observer = new ResizeObserver((entries) =>
      setWidth(Math.max(150, entries[0].contentRect.width)),
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (!pdf || !canvas.current) return
    let cancelled = false
    let render: RenderTask | undefined
    const target = canvas.current
    void pdf
      .getPage(page)
      .then(async (pdfPage) => {
        if (cancelled) return
        setLoading(true)
        setText('')
        setError('')
        const base = pdfPage.getViewport({ scale: 1 })
        const scale = Math.min(width / base.width, 1.5)
        const viewport = pdfPage.getViewport({ scale })
        const ratio = window.devicePixelRatio || 1
        target.width = viewport.width * ratio
        target.height = viewport.height * ratio
        target.style.width = `${viewport.width}px`
        target.style.height = `${viewport.height}px`
        render = pdfPage.render({ canvas: target, viewport, transform: [ratio, 0, 0, ratio, 0, 0] })
        const content = await pdfPage.getTextContent()
        if (!cancelled)
          setText(content.items.map((item) => ('str' in item ? item.str : '')).join('\n'))
        await render.promise
        if (!cancelled) setLoading(false)
      })
      .catch((error) => {
        if (!cancelled && error?.name !== 'RenderingCancelledException') {
          setError(errorMessage(error))
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
      render?.cancel()
    }
  }, [pdf, page, width])
  return (
    <Box ref={container} sx={{ width: '100%', minWidth: 0 }}>
      <ErrorNotice error={error} />
      {loading && !error && (
        <Typography role="status" sx={{ py: 2 }}>
          {content.loadingPdfPage}
        </Typography>
      )}
      <Box
        sx={{
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          overflow: 'hidden',
          bgcolor: 'action.hover',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <canvas
          ref={canvas}
          role="img"
          aria-label={content.canvasLabel(document.name, page)}
          style={{ maxWidth: '100%' }}
        />
      </Box>
      <Box component="details" sx={{ mt: 2 }}>
        <Typography component="summary" sx={{ cursor: 'pointer', fontWeight: 600 }}>
          {content.accessiblePageText}
        </Typography>
        <Typography
          component="pre"
          sx={{
            fontFamily: 'inherit',
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
            fontSize: 13,
          }}
        >
          {text || content.noTextMessage}
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2, overflowWrap: 'anywhere' }}>
        {content.documentHash(document.hash)}
      </Typography>
    </Box>
  )
}
