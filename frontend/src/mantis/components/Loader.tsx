// Adapted from seed/src/components/Loader.tsx.
import Box from '@mui/material/Box'
import LinearProgress from '@mui/material/LinearProgress'

export default function Loader({ label }: { label: string }) {
  return (
    <Box sx={{ position: 'fixed', top: 0, left: 0, zIndex: 2001, width: 1 }}>
      <LinearProgress color="primary" aria-label={label} />
    </Box>
  )
}
