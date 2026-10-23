// Adapted from seed/src/layout/DashboardLayout/Drawer/DrawerContent/Navigation/NavItem.tsx.
// The presentation is Mantis's expanded vertical item; routing and selection
// are supplied by the workspace rather than the template's Next.js/menu store.
import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Typography from '@mui/material/Typography'
import { Link } from 'react-router-dom'

interface Props {
  label: string
  to: string
  icon?: ReactNode
  selected: boolean
  onClick: () => void
  ariaLabel?: string
}

export default function NavItem({ label, to, icon, selected, onClick, ariaLabel }: Props) {
  return (
    <Box sx={{ position: 'relative' }}>
      <ListItemButton
        component={Link}
        to={to}
        selected={selected}
        onClick={onClick}
        aria-label={ariaLabel}
        aria-current={selected ? 'page' : undefined}
        sx={{
          pl: '28px',
          pr: 2,
          py: 1,
          '&:hover': { bgcolor: 'primary.lighter' },
          '&.Mui-selected': {
            bgcolor: 'primary.lighter',
            borderRight: '0 solid',
            borderColor: 'primary.main',
            color: 'primary.main',
            '&:hover': { color: 'primary.main', bgcolor: 'primary.lighter' },
          },
        }}
      >
        {icon && (
          <ListItemIcon
            sx={{ minWidth: 28, color: selected ? 'primary.main' : 'text.primary', fontSize: 16 }}
          >
            {icon}
          </ListItemIcon>
        )}
        <ListItemText
          primary={
            <Typography
              variant="h6"
              component="span"
              sx={{
                color: selected ? 'primary.main' : 'text.primary',
                whiteSpace: 'normal',
                overflowWrap: 'anywhere',
              }}
            >
              {label}
            </Typography>
          }
        />
      </ListItemButton>
    </Box>
  )
}
