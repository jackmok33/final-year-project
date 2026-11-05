import { useContent } from '../../hooks/useContent'
import UploadOutlined from '@ant-design/icons/UploadOutlined'
import { Box, Button, Stack, Typography } from '@mui/material'
import { type DocumentType } from '../../domain/types'
import { FilePicker } from '../FilePicker'
import MainCard from '../../mantis/components/MainCard'
export function DocumentUpload({
  type,
  documents = [],
  checking,
  disabled,
  onSelect,
  onRemove,
}: {
  type: DocumentType
  documents?: { file: File; pages: number }[]
  checking: boolean
  disabled: boolean
  onSelect: (files: File[]) => void
  onRemove: (index: number) => void
}) {
  const content = useContent('documentUpload')
  const multiple = type === 'reference'
  const picker = multiple
    ? { onSelectMany: onSelect }
    : { onSelect: (file?: File) => onSelect(file ? [file] : []) }
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
            {content.pdfMaximum20Mb}
          </Typography>
        </Box>
        <FilePicker
          label={
            checking
              ? content.checking
              : multiple
                ? content.addReferences
                : documents.length
                  ? content.replace
                  : content.choosePdf
          }
          inputLabel={content.uploadLabel(content.documentNames[type])}
          accept=".pdf,application/pdf"
          icon={<UploadOutlined aria-hidden="true" />}
          disabled={disabled}
          {...picker}
        />
      </Stack>
      {documents.map((document, index) => (
        <Stack
          key={index}
          direction="row"
          sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 2, mt: 1 }}
        >
          <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
            {content.documentSummary(document.file.name, document.pages)}
          </Typography>
          <Button
            size="small"
            onClick={() => onRemove(index)}
            disabled={disabled}
            aria-label={multiple ? content.removeReference(document.file.name, index) : undefined}
          >
            {content.remove(content.documentNames[type])}
          </Button>
        </Stack>
      ))}
    </MainCard>
  )
}
