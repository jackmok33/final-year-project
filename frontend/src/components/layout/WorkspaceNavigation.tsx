import { Box, Link as MuiLink, List, Stack, Typography } from '@mui/material'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { headerHeight } from '../../app/theme'
import { useContent } from '../../hooks/useContent'
import SimpleBarScroll from '../../mantis/components/SimpleBarScroll'
import DrawerHeaderStyled from '../../mantis/layout/DrawerHeaderStyled'
import NavItem from '../../mantis/layout/NavItem'
import { UclLogo } from '../UclLogo'

export interface NavigationItem {
  id: string
  label: string
  path: string
  selected: boolean
  icon?: ReactNode
}

export function WorkspaceNavigation({
  admin,
  items,
  onNavigate,
}: {
  admin: boolean
  items: NavigationItem[]
  onNavigate: () => void
}) {
  const content = useContent('workspaceNavigation')
  return (
    <Stack
      component="nav"
      aria-label={content.workspaceNavigation}
      spacing={2.5}
      useFlexGap
      sx={{ height: '100%', minHeight: 0, pb: 2, whiteSpace: 'normal' }}
    >
      <DrawerHeaderStyled
        open
        sx={{ minHeight: headerHeight, borderBottom: 1, borderColor: 'divider' }}
      >
        <MuiLink
          component={Link}
          to={admin ? '/admin/health' : '/modules'}
          onClick={onNavigate}
          sx={{ display: 'inline-flex' }}
        >
          <Box sx={{ '& img': { width: 115, p: 0 } }}>
            <UclLogo />
          </Box>
        </MuiLink>
      </DrawerHeaderStyled>
      <SimpleBarScroll>
        <Box>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ px: 2.5, mb: 1, fontWeight: 500 }}
          >
            {admin ? content.administration : content.programme}
          </Typography>
          <List component="div" disablePadding>
            {items.map(({ id, label, path, icon, selected }) => (
              <NavItem
                key={id}
                label={label}
                to={path}
                icon={icon}
                selected={selected}
                ariaLabel={admin ? undefined : content.openModule(label)}
                onClick={onNavigate}
              />
            ))}
          </List>
        </Box>
      </SimpleBarScroll>
    </Stack>
  )
}
