import type { Theme } from '@mui/material/styles'
import type { ButtonProps } from '@mui/material/Button'

// Shared types for the imported Mantis controls and factories. The template's
// demo application is not a dependency.
export type ButtonVariantProps = 'contained' | 'outlined' | 'dashed' | 'text' | 'shadow' | 'light'
export type IconButtonShapeProps = 'rounded' | 'square'
export type AvatarTypeProps = 'filled' | 'outlined' | 'combined'
export type SizeProps = 'badge' | 'xs' | 'sm' | 'md' | 'lg' | 'xl'
export type ColorProps = ButtonProps['color'] | 'default'
export type ExtendedStyleProps = { color: ColorProps; theme: Theme }

export interface CustomShadows {
  button: string
  text: string
  z1: string
  primary: string
  secondary: string
  error: string
  warning: string
  info: string
  success: string
  grey: string
  primaryButton: string
  secondaryButton: string
  errorButton: string
  warningButton: string
  infoButton: string
  successButton: string
  greyButton: string
}
