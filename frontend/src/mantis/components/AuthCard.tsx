// Adapted from the supplied Mantis React Next TS 4.0.1 template; see src/mantis/README.md.
// material-ui
import { useTheme } from '@mui/material/styles'
import Box from '@mui/material/Box'

// project imports
import MainCard, { MainCardProps } from './MainCard'

// ==============================|| AUTHENTICATION - CARD WRAPPER ||============================== //

export default function AuthCard({ children, sx = [], ...other }: MainCardProps) {
  const theme = useTheme()

  return (
    <MainCard
      sx={[
        {
          maxWidth: { xs: 400, sm: 475 },
          margin: { xs: 2.5, md: 3 },
          '& > *': { flexGrow: 1, flexBasis: '50%' },
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      content={false}
      {...other}
      border={false}
      boxShadow
      shadow={(theme.vars ?? theme).customShadows?.z1 ?? theme.shadows[1]}
    >
      <Box sx={{ p: { xs: 2, sm: 3, md: 4, xl: 5 } }}>{children}</Box>
    </MainCard>
  )
}
