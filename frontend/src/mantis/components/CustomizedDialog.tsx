// Controlled adaptation of Mantis 4.0.1 sections/components-overview/dialogs/CustomizedDialog.tsx.
import CloseOutlined from '@ant-design/icons/CloseOutlined'
import { Dialog, DialogContent, DialogTitle } from '@mui/material'
import { styled } from '@mui/material/styles'
import { useId, type ReactNode } from 'react'
import IconButton from './IconButton'

const BootstrapDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialogContent-root': {
    padding: theme.spacing(3),
  },
}))

export interface CustomizedDialogProps {
  open: boolean
  title: string
  closeLabel: string
  children: ReactNode
  onClose: () => void
  busy?: boolean
}

export default function CustomizedDialog({
  open,
  title,
  closeLabel,
  children,
  onClose,
  busy = false,
}: CustomizedDialogProps) {
  const titleId = useId()
  function close() {
    if (!busy) onClose()
  }
  return (
    <BootstrapDialog open={open} fullWidth maxWidth="sm" aria-labelledby={titleId} onClose={close}>
      <DialogTitle id={titleId} sx={{ m: 0, p: 2, pr: 7 }}>
        {title}
      </DialogTitle>
      <IconButton
        aria-label={closeLabel}
        onClick={close}
        disabled={busy}
        color="secondary"
        sx={{ position: 'absolute', right: 10, top: 10 }}
      >
        <CloseOutlined aria-hidden="true" />
      </IconButton>
      <DialogContent dividers aria-busy={busy || undefined}>
        {children}
      </DialogContent>
    </BootstrapDialog>
  )
}
