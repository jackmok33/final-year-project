// Adapted from Mantis 4.0.1 views/forms/layouts/action-bar.tsx; see source-manifest.json.
import type { ReactNode } from 'react'
import { CardActions, Stack } from '@mui/material'

/** The template's separated action bar, kept independent of form state. */
export default function FormActions({ children }: { children: ReactNode }) {
  return (
    <CardActions sx={{ borderTop: 1, borderColor: 'divider', px: 0, pt: 2.5, pb: 0 }}>
      <Stack
        direction="row"
        sx={{ gap: 1, justifyContent: 'flex-end', flexWrap: 'wrap', width: 1 }}
      >
        {children}
      </Stack>
    </CardActions>
  )
}
