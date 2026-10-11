import { useContent } from '../../hooks/useContent'
import { Button, type ButtonProps } from '@mui/material'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Citation, DocumentRecord } from '../../domain/types'

export function EvidenceLink({
  applicationId,
  citation,
  document,
  runId,
  children,
  size = 'small',
  sx,
}: {
  applicationId: string
  citation: Pick<Citation, 'documentId' | 'page'>
  document?: DocumentRecord
  runId?: string
  children?: ReactNode
  size?: ButtonProps['size']
  sx?: ButtonProps['sx']
}) {
  const content = useContent('evidenceLink')
  const valid =
    document?.id === citation.documentId &&
    Number.isInteger(citation.page) &&
    citation.page >= 1 &&
    citation.page <= document.pages
  const query = new URLSearchParams({
    document: citation.documentId,
    page: String(citation.page),
  })
  if (runId) query.set('run', runId)

  return (
    <Button
      component={Link}
      to={`/applications/${encodeURIComponent(applicationId)}/evidence?${query}`}
      disabled={!valid}
      size={size}
      sx={sx}
    >
      {children ??
        (document
          ? content.sourceLabel(document.name, citation.page)
          : content.unsupportedSourceReference)}
    </Button>
  )
}
