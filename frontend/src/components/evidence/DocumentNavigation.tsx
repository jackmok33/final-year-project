import { useContent } from '../../hooks/useContent'
import { MenuItem, Stack, TextField } from '@mui/material'
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
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 2 }}>
      <TextField
        select
        label={content.originalDocument}
        value={doc.id}
        onChange={(e) => onDocumentChange(e.target.value)}
      >
        {documents.map((d) => (
          <MenuItem value={d.id} key={d.id}>
            {d.name}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        select
        label={content.page}
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
  )
}
