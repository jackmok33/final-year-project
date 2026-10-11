import { useContent } from '../../hooks/useContent'
import { UploadFileOutlined } from '@mui/icons-material'
import { Box, Button, Stack, Typography } from '@mui/material'
import { type DocumentType } from '../../domain/types'
import { FilePicker } from '../FilePicker'
export function DocumentUpload({
  type,
  document,
  checking,
  disabled,
  onSelect,
  onRemove,
}: {
  type: DocumentType
  document?: { file: File; pages: number }
  checking: boolean
  disabled: boolean
  onSelect: (file?: File) => void
  onRemove: () => void
}) {
  const content = useContent('documentUpload')
  return (
    <Box sx={{ border: '1px dashed #BFA5D6', borderRadius: 1, p: 2 }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <Box>
          <Typography sx={{ fontWeight: 600 }}>{content.documentNames[type]}</Typography>
          <Typography variant="body2" color="text.secondary">
            {document
              ? content.documentSummary(document.file.name, document.pages)
              : content.pdfMaximum20Mb}
          </Typography>
        </Box>
        <FilePicker
          label={checking ? content.checking : document ? content.replace : content.choosePdf}
          inputLabel={content.uploadLabel(content.documentNames[type])}
          accept=".pdf,application/pdf"
          icon={<UploadFileOutlined />}
          disabled={disabled}
          onSelect={onSelect}
        />
      </Stack>
      {document && (
        <Button size="small" onClick={onRemove}>
          {content.remove(content.documentNames[type])}
        </Button>
      )}
    </Box>
  )
}
