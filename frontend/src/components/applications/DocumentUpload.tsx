import { useContent } from '../../hooks/useContent'
import UploadOutlined from '@ant-design/icons/UploadOutlined'
import { Box, Button, Stack, Typography } from '@mui/material'
import { type DocumentType } from '../../domain/types'
import { FilePicker } from '../FilePicker'
import MainCard from '../../mantis/components/MainCard'
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
    <MainCard
      content={false}
      sx={{
        borderStyle: 'dashed',
        borderColor: 'divider',
        bgcolor: 'action.hover',
        p: 2,
      }}
    >
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
          icon={<UploadOutlined aria-hidden="true" />}
          disabled={disabled}
          onSelect={onSelect}
        />
      </Stack>
      {document && (
        <Button size="small" onClick={onRemove} disabled={disabled}>
          {content.remove(content.documentNames[type])}
        </Button>
      )}
    </MainCard>
  )
}
