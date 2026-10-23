// Adapted from seed/src/components/third-party/SimpleBar.tsx.
import { styled, useTheme, alpha, type SxProps, type Theme } from '@mui/material/styles'
import Box from '@mui/material/Box'
import SimpleBar, { type Props } from 'simplebar-react'
import 'simplebar-react/dist/simplebar.min.css'

// Native touch scrolling is supported by SimpleBar too, so no user-agent-specific
// BrowserView/MobileView dependency is needed for the workspace's vertical menu.
const RootStyle = styled(Box)({ flexGrow: 1, flexBasis: 0, minHeight: 0, overflow: 'hidden' })
const SimpleBarStyle = styled(SimpleBar)(({ theme }) => ({
  maxHeight: '100%',
  height: '100%',
  '& .simplebar-scrollbar': {
    '&:before': { background: alpha(theme.palette.grey[500], 0.48) },
    '&.simplebar-visible:before': { opacity: 1 },
  },
  '& .simplebar-track.simplebar-vertical': { width: 10 },
  '& .simplebar-track.simplebar-horizontal .simplebar-scrollbar': { height: 6 },
  '& .simplebar-mask': { zIndex: 'inherit' },
}))

export default function SimpleBarScroll({
  children,
  sx,
  ...other
}: Props & { sx?: SxProps<Theme> }) {
  const theme = useTheme()
  return (
    <RootStyle>
      <SimpleBarStyle
        clickOnTrack={false}
        sx={sx}
        data-simplebar-direction={theme.direction}
        {...other}
      >
        {children}
      </SimpleBarStyle>
    </RootStyle>
  )
}
