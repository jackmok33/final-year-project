// Adapted from Mantis 4.0.1 components/third-party/dropzone/SingleFile.tsx and PlaceholderContent.tsx.
import { useDropzone } from 'react-dropzone'
import { Box, Stack, Typography } from '@mui/material'
import { styled } from '@mui/material/styles'
import uploadCover from '../assets/upload.svg'

const DropzoneWrapper = styled('div')(({ theme }) => ({
  outline: 'none',
  overflow: 'hidden',
  position: 'relative',
  padding: theme.spacing(3, 1),
  borderRadius: theme.shape.borderRadius,
  transition: theme.transitions.create('padding'),
  background: theme.palette.background.paper,
  border: `1px dashed ${theme.palette.divider}`,
  '&:hover': { cursor: 'pointer', background: theme.palette.action.hover },
  '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
}))

export default function SingleFileUpload({
  disabled,
  onSelect,
  onReject,
  labels,
}: {
  disabled: boolean
  onSelect: (file: File) => void
  onReject: () => void
  labels: {
    title: string
    description: string
    browse: string
    ending: string
    input: string
    fileInput: string
  }
}) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/zip': ['.zip'] },
    multiple: false,
    disabled,
    onDropAccepted: (files) => {
      if (files[0]) onSelect(files[0])
    },
    onDropRejected: onReject,
  })
  return (
    <Box>
      <input
        {...getInputProps({ 'aria-label': labels.fileInput })}
        disabled={disabled}
        style={{ display: 'none' }}
      />
      <DropzoneWrapper
        {...getRootProps({ role: 'button', 'aria-label': labels.input, 'aria-disabled': disabled })}
        sx={{
          ...(isDragActive && { borderColor: 'primary.main', bgcolor: 'primary.lighter' }),
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          sx={{
            gap: 3,
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: { xs: 'center', md: 'left' },
          }}
        >
          <Box
            component="img"
            src={uploadCover}
            alt=""
            width={150}
            height={120}
            sx={{ objectFit: 'contain' }}
          />
          <Stack spacing={1}>
            <Typography variant="h4" component="p">
              {labels.title}
            </Typography>
            <Typography color="text.secondary">
              {labels.description}{' '}
              <Box component="span" sx={{ color: 'primary.main' }}>
                {labels.browse}
              </Box>{' '}
              {labels.ending}
            </Typography>
          </Stack>
        </Stack>
      </DropzoneWrapper>
    </Box>
  )
}
