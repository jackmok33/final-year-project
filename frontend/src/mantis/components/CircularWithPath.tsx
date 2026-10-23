// Adapted from seed/src/components/@extended/progress/CircularWithPath.tsx.
import CircularProgress, {
  type CircularProgressProps,
  circularProgressClasses,
} from '@mui/material/CircularProgress'
import Box from '@mui/material/Box'

export default function CircularWithPath({ sx, size, thickness, ...other }: CircularProgressProps) {
  return (
    <Box sx={{ position: 'relative', display: 'inline-flex' }}>
      <CircularProgress
        variant="determinate"
        value={100}
        size={size}
        thickness={thickness}
        sx={{ color: 'grey.200' }}
        aria-hidden="true"
        role="presentation"
      />
      <CircularProgress
        size={size}
        thickness={thickness}
        {...other}
        sx={[
          {
            position: 'absolute',
            left: 0,
            [`& .${circularProgressClasses.circle}`]: { strokeLinecap: 'round' },
          },
          ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
        ]}
      />
    </Box>
  )
}
