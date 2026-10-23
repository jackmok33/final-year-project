// Adapted from the supplied Mantis React Next TS 4.0.1 template; see src/mantis/README.md.
import type { CSSProperties, ReactNode, Ref } from 'react'

// material-ui
import { useTheme } from '@mui/material/styles'
import Card, { CardProps } from '@mui/material/Card'
import CardContent, { CardContentProps } from '@mui/material/CardContent'
import CardHeader, { CardHeaderProps } from '@mui/material/CardHeader'
import Divider from '@mui/material/Divider'

// ==============================|| CUSTOM - MAIN CARD ||============================== //

export interface MainCardProps {
  border?: boolean
  id?: string
  boxShadow?: boolean
  children?: ReactNode
  subheader?: ReactNode | string
  style?: CSSProperties
  content?: boolean
  contentSX?: CardContentProps['sx']
  darkTitle?: boolean
  divider?: boolean
  sx?: CardProps['sx']
  secondary?: CardHeaderProps['action']
  shadow?: string
  elevation?: number
  title?: ReactNode | string
  codeHighlight?: boolean
  modal?: boolean
  onClick?: () => void
  ref?: Ref<HTMLDivElement>
}

export default function MainCard({
  border = true,
  boxShadow,
  children,
  subheader,
  content = true,
  contentSX = {},
  darkTitle,
  divider = true,
  elevation,
  secondary,
  shadow,
  sx = {},
  title,
  codeHighlight = false,
  modal = false,
  ref,
  ...others
}: MainCardProps) {
  const theme = useTheme()
  const palette = (theme.vars ?? theme).palette
  const cardShadow = (theme.vars ?? theme).customShadows?.z1 ?? theme.shadows[1]

  return (
    <Card
      elevation={elevation || 0}
      sx={[
        (theme) => ({
          position: 'relative',
          ...(border && { border: `1px solid ${palette.grey.A800 ?? palette.divider}` }),
          borderRadius: 1,
          boxShadow: boxShadow && !border ? shadow || cardShadow : 'inherit',
          ':hover': { boxShadow: boxShadow ? shadow || cardShadow : 'inherit' },
          ...(theme.palette.mode === 'dark' && {
            borderColor: palette.divider,
            boxShadow: shadow || cardShadow,
            ':hover': { boxShadow: shadow || cardShadow },
          }),
          ...(codeHighlight && {
            '& pre': {
              margin: 0,
              padding: '12px !important',
              fontFamily: theme.typography.fontFamily,
              fontSize: '0.75rem',
            },
          }),
          ...(modal && {
            position: 'absolute' as const,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: { xs: `calc(100% - 50px)`, sm: 'auto' },
            maxWidth: 768,
          }),
        }),
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      ref={ref}
      {...others}
    >
      {/* card header and action */}
      {title && (
        <CardHeader
          sx={{ p: 2.5 }}
          slotProps={{
            title: { variant: darkTitle ? 'h4' : 'subtitle1', component: 'h2' },
            action: { sx: { m: '0px auto', alignSelf: 'center' } },
          }}
          title={title}
          action={secondary}
          subheader={subheader}
        />
      )}

      {/* content & header divider */}
      {title && divider && <Divider />}

      {/* card content */}
      {content && (
        <CardContent
          sx={contentSX}
          {...(modal && {
            slotProps: {
              root: {
                sx: { overflowY: 'auto', minHeight: 'auto', maxHeight: `calc(100vh - 200px)` },
              },
            },
          })}
        >
          {children}
        </CardContent>
      )}
      {!content && children}
    </Card>
  )
}
