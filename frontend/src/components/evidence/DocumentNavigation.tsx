import { useId } from 'react'
import { useContent } from '../../hooks/useContent'
import { InputLabel, MenuItem, Stack, TextField } from '@mui/material'
import { type DocumentRecord } from '../../domain/types'

export function DocumentNavigation({
  documents,
  doc,
  page,
  onDocumentChange,
  changePage,
}: {
  documents: DocumentRecord[]
  doc: DocumentRecord
  page: number
  onDocumentChange: (id: string) => void
  changePage: (page: number) => void
}) {
  const content = useContent('documentNavigation')
  const fieldId = useId()
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 2 }}>
      <Stack sx={{ gap: 1, minWidth: 0, flex: 1 }}>
        <InputLabel
          id={`${fieldId}-originalDocument-label`}
          htmlFor={`${fieldId}-originalDocument`}
        >
          {content.originalDocument}
        </InputLabel>
        <TextField
          slotProps={{ select: { labelId: `${fieldId}-originalDocument-label` } }}
          select
          id={`${fieldId}-originalDocument`}
          value={doc.id}
          onChange={(e) => onDocumentChange(e.target.value)}
        >
          {documents.map((d) => (
            <MenuItem value={d.id} key={d.id}>
              {d.name}
            </MenuItem>
          ))}
        </TextField>
      </Stack>
      <Stack sx={{ gap: 1, minWidth: 0, flex: 1 }}>
        <InputLabel id={`${fieldId}-page-label`} htmlFor={`${fieldId}-page`}>
          {content.page}
        </InputLabel>
        <TextField
          slotProps={{ select: { labelId: `${fieldId}-page-label` } }}
          select
          id={`${fieldId}-page`}
          value={page}
          onChange={(e) => changePage(Number(e.target.value))}
        >
          {Array.from({ length: doc.pages }, (_, i) => (
            <MenuItem key={i} value={i + 1}>
              {content.pageOption(i + 1, doc.pages)}
            </MenuItem>
          ))}
        </TextField>
      </Stack>
    </Stack>
  )
}
