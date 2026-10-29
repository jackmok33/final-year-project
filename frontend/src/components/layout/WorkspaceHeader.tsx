import LogoutOutlined from '@ant-design/icons/LogoutOutlined'
import LockOutlined from '@ant-design/icons/LockOutlined'
import MenuUnfoldOutlined from '@ant-design/icons/MenuUnfoldOutlined'
import { Box, Divider, Menu, MenuItem, Toolbar, Typography } from '@mui/material'
import { useId } from 'react'
import { Link } from 'react-router-dom'
import { headerHeight, sidebarWidth } from '../../app/theme'
import type { User } from '../../domain/types'
import { useContent } from '../../hooks/useContent'
import Avatar from '../../mantis/components/Avatar'
import IconButton from '../../mantis/components/IconButton'
import AppBarStyled from '../../mantis/layout/AppBarStyled'

export function WorkspaceHeader({
  user,
  admin,
  accountAnchor,
  onOpenAccount,
  onCloseAccount,
  onOpenNavigation,
  onChangePassword,
  onSignOut,
}: {
  user?: User
  admin: boolean
  accountAnchor: HTMLElement | null
  onOpenAccount: (anchor: HTMLElement) => void
  onCloseAccount: () => void
  onOpenNavigation: () => void
  onChangePassword: () => void
  onSignOut: () => void
}) {
  const content = useContent('workspaceHeader')
  const menuId = useId()
  return (
    <AppBarStyled
      open
      position="fixed"
      color="inherit"
      elevation={0}
      sx={{
        bgcolor: 'background.paper',
        color: 'text.primary',
        height: headerHeight,
        width: { xs: '100%', md: `calc(100% - ${sidebarWidth}px)` },
        ml: { xs: 0, md: `${sidebarWidth}px` },
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <Toolbar sx={{ minHeight: `${headerHeight}px !important`, gap: 2 }}>
        <IconButton
          color="secondary"
          variant="light"
          sx={{ display: { md: 'none' } }}
          aria-label={content.openNavigation}
          onClick={onOpenNavigation}
        >
          <MenuUnfoldOutlined aria-hidden="true" />
        </IconButton>
        <Box sx={{ flex: 1 }} />
        <IconButton
          aria-label={content.accountMenu}
          aria-haspopup="menu"
          aria-expanded={Boolean(accountAnchor)}
          aria-controls={accountAnchor ? menuId : undefined}
          onClick={(event) => onOpenAccount(event.currentTarget)}
          size="small"
        >
          <Avatar size="sm" aria-hidden="true">
            {user?.name[0]}
          </Avatar>
        </IconButton>
        <Menu
          id={menuId}
          anchorEl={accountAnchor}
          open={Boolean(accountAnchor)}
          onClose={onCloseAccount}
        >
          <Box sx={{ px: 2, py: 1 }}>
            <Typography variant="subtitle1">{user?.name}</Typography>
            <Typography variant="body2" color="text.secondary">
              {admin ? content.websiteAdministrator : content.admissionsTutor}
            </Typography>
          </Box>
          <Divider />
          <MenuItem onClick={onChangePassword}>
            <LockOutlined aria-hidden="true" style={{ marginRight: 8 }} />
            {content.changePassword}
          </MenuItem>
          {user?.roles.length === 2 && (
            <MenuItem
              component={Link}
              to={admin ? '/modules' : '/admin/health'}
              onClick={onCloseAccount}
            >
              {content.switchToWorkspace(admin ? content.tutorWorkspace : content.adminWorkspace)}
            </MenuItem>
          )}
          <MenuItem onClick={onSignOut}>
            <LogoutOutlined aria-hidden="true" style={{ marginRight: 8 }} />
            {content.signOut}
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBarStyled>
  )
}
