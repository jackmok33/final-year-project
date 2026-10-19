import {
  FolderOutlined,
  Logout,
  Menu,
  MonitorHeartOutlined,
  PeopleOutlined,
  SettingsOutlined,
  StorageOutlined,
} from '@mui/icons-material'
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  Link as MuiLink,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Toolbar,
  Typography,
} from '@mui/material'
import { useEffect } from 'react'
import { Link, Navigate, Outlet, useLocation, useMatch } from 'react-router-dom'
import { admissionsApi, useApplicationQuery, useBatchQuery, useMeQuery } from '../app/api'
import { headerHeight, sidebarWidth } from '../app/theme'
import {
  selectProgramme,
  setNavigationOpen,
  signOut,
  useAppDispatch,
  useAppSelector,
} from '../app/store'
import { useWorkspace } from '../app/workspace'
import { applicationIntakeYear } from '../domain/intakes'
import { useContent } from '../hooks/useContent'
import { ErrorNotice, Loading } from './common'
import { UclLogo } from './UclLogo'

export function Protected({ admin = false }: { admin?: boolean }) {
  const id = useAppSelector((s) => s.session.userId)
  const {
    data: user,
    error,
    isLoading,
  } = useMeQuery(undefined, { skip: !id, pollingInterval: 4000 })
  if (!id) return <Navigate to="/login" replace />
  if (isLoading) return <Loading />
  if (error || !user) return <SessionError error={error} />
  if (!(admin ? user.roles.includes('admin') : user.roles.includes('tutor')))
    return <Navigate to={user.roles.includes('admin') ? '/admin/health' : '/modules'} replace />
  return <Outlet />
}

function SessionError({ error }: { error: unknown }) {
  const content = useContent('layout')
  const dispatch = useAppDispatch()
  return (
    <Stack spacing={2} sx={{ maxWidth: 600, mx: 'auto', p: 4 }}>
      <ErrorNotice error={error} />
      <Button
        onClick={() => {
          dispatch(signOut())
          dispatch(admissionsApi.util.resetApiState())
        }}
      >
        {content.returnToDemoSignIn}
      </Button>
    </Stack>
  )
}

export function Layout() {
  const content = useContent('layout')
  const { user, programme, programmes, intakeYear } = useWorkspace()
  const location = useLocation()
  const dispatch = useAppDispatch()
  const open = useAppSelector((s) => s.ui.navigationOpen)
  const applicationId = useMatch('/applications/:id/*')?.params.id
  const { currentData: applicationData } = useApplicationQuery(applicationId ?? '', {
    skip: !applicationId || applicationId === 'new',
  })
  const applicationProgramme =
    applicationId && applicationId !== 'new'
      ? programmes.find((p) => p.id === applicationData?.application.programmeId)
      : undefined
  const applicationProgrammeId = applicationProgramme?.id
  const applicationYear =
    applicationData && applicationProgramme
      ? applicationIntakeYear(applicationData.application, applicationProgramme)
      : undefined
  const userId = user?.id
  const batchId = useMatch('/batches/:batchId')?.params.batchId
  const { currentData: batch } = useBatchQuery(batchId ?? '', { skip: !batchId })
  const batchProgramme = programmes.find((p) => p.id === batch?.programmeId)
  const recordProgrammeId = applicationProgrammeId ?? batchProgramme?.id
  const recordYear = applicationYear ?? batch?.intakeYear
  useEffect(() => {
    if (userId && recordProgrammeId && recordYear)
      dispatch(
        selectProgramme({
          userId,
          programmeId: recordProgrammeId,
          intakeYear: recordYear,
        }),
      )
  }, [recordProgrammeId, recordYear, userId, dispatch])

  const isAdmin = location.pathname.startsWith('/admin')
  const moduleId = useMatch('/modules/:id')?.params.id
  const viewingModules = location.pathname.startsWith('/modules')
  const currentModule = viewingModules ? programmes.find((p) => p.id === moduleId) : programme
  const items = [
    [content.serviceHealth, '/admin/health', <MonitorHeartOutlined />],
    [content.usersAccess, '/admin/users', <PeopleOutlined />],
    [content.programmeSettings, '/admin/programme', <SettingsOutlined />],
    [content.dataOperations, '/admin/data', <StorageOutlined />],
  ] as const
  function closeNavigation() {
    dispatch(setNavigationOpen(false))
  }
  const navigation = (
    <Stack
      component="nav"
      aria-label={content.workspaceNavigation}
      spacing={2.5}
      useFlexGap
      sx={{ minHeight: '100%', pb: 2 }}
    >
      <Stack
        component={Link}
        to={isAdmin ? '/admin/health' : '/modules'}
        onClick={closeNavigation}
        direction="row"
        spacing={1.5}
        sx={{
          minHeight: headerHeight,
          px: 2.5,
          alignItems: 'center',
          borderBottom: 1,
          borderColor: 'divider',
          textDecoration: 'none',
          color: 'text.primary',
        }}
      >
        <UclLogo />
      </Stack>
      <Box>
        <Typography variant="body2" color="text.secondary" sx={{ px: 2.5, mb: 1, fontWeight: 500 }}>
          {isAdmin ? content.administration : content.modules}
        </Typography>
        <List component="div" disablePadding>
          {(isAdmin
            ? items.map(([label, path, icon]) => ({
                id: path,
                label,
                path,
                icon,
                selected: location.pathname === path,
              }))
            : programmes.map((p) => ({
                id: p.id,
                label: p.name,
                path: `/modules/${encodeURIComponent(p.id)}`,
                icon: <FolderOutlined />,
                selected: currentModule?.id === p.id,
              }))
          ).map(({ id, label, path, icon, selected }) => (
            <ListItemButton
              key={id}
              component={Link}
              to={path}
              selected={selected}
              aria-label={!isAdmin ? content.openModule(label) : undefined}
              aria-current={selected ? 'page' : undefined}
              onClick={closeNavigation}
              sx={{
                px: 2.5,
                py: 1.25,
                borderRight: 3,
                borderColor: selected ? 'primary.main' : 'transparent',
                color: selected ? 'primary.main' : 'text.secondary',
                '&.Mui-selected': { bgcolor: 'primary.light', color: 'primary.main' },
                '&.Mui-selected:hover': { bgcolor: 'primary.light' },
              }}
            >
              <ListItemIcon
                sx={{ minWidth: 32, color: 'inherit', '& .MuiSvgIcon-root': { fontSize: 20 } }}
              >
                {icon}
              </ListItemIcon>
              <ListItemText
                primary={label}
                slotProps={{
                  primary: {
                    sx: {
                      fontSize: 14,
                      fontWeight: selected ? 600 : 400,
                      overflowWrap: 'anywhere',
                    },
                  },
                }}
              />
            </ListItemButton>
          ))}
        </List>
      </Box>
      {user?.roles.length === 2 && (
        <Button
          component={Link}
          to={isAdmin ? '/modules' : '/admin/health'}
          onClick={closeNavigation}
        >
          {content.switchToWorkspace(isAdmin ? content.tutorWorkspace : content.adminWorkspace)}
        </Button>
      )}
      <Box sx={{ flexGrow: 1 }} />
      <Divider />
      <Box sx={{ px: 2.5 }}>
        <Typography sx={{ fontWeight: 600 }}>
          {isAdmin ? content.websiteAdministrator : content.admissionsTutor}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {user?.name}
        </Typography>
      </Box>
      <Button
        startIcon={<Logout />}
        color="secondary"
        sx={{ justifyContent: 'flex-start', mx: 1.5 }}
        onClick={() => {
          closeNavigation()
          dispatch(signOut())
          dispatch(admissionsApi.util.resetApiState())
        }}
      >
        {content.signOut}
      </Button>
    </Stack>
  )

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <a className="skip-link" href="#main-content">
        {content.skipToMainContent}
      </a>
      <Box sx={{ width: { md: sidebarWidth }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': { width: sidebarWidth },
          }}
        >
          {navigation}
        </Drawer>
        <Drawer
          variant="temporary"
          slotProps={{ paper: { 'aria-label': content.workspaceNavigation } }}
          open={open}
          onClose={closeNavigation}
          sx={{ display: { md: 'none' }, '& .MuiDrawer-paper': { width: sidebarWidth } }}
        >
          {navigation}
        </Drawer>
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <AppBar
          position="sticky"
          elevation={0}
          sx={{
            bgcolor: 'background.paper',
            color: 'text.primary',
            height: headerHeight,
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Toolbar sx={{ minHeight: `${headerHeight}px !important`, gap: 2 }}>
            <IconButton
              sx={{ display: { md: 'none' }, color: 'text.secondary' }}
              aria-label={content.openNavigation}
              onClick={() => dispatch(setNavigationOpen(true))}
            >
              <Menu />
            </IconButton>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              {isAdmin ? (
                <Typography variant="body2" color="text.secondary">
                  {content.headerTitle(
                    content.administration,
                    items.find(([, path]) => location.pathname === path)?.[0] ??
                      content.administration,
                  )}
                </Typography>
              ) : (
                <MuiLink component={Link} to="/modules" variant="body2">
                  {content.allModules}
                </MuiLink>
              )}
              {!isAdmin && currentModule && (
                <Typography
                  variant="subtitle2"
                  component="p"
                  noWrap
                  title={currentModule.name}
                  sx={{ mt: 0.25 }}
                >
                  {currentModule.name}
                </Typography>
              )}
            </Box>
            <Avatar
              sx={{
                width: 32,
                height: 32,
                bgcolor: 'primary.light',
                color: 'primary.main',
                fontSize: 14,
              }}
              aria-hidden="true"
            >
              {user?.name[0]}
            </Avatar>
          </Toolbar>
        </AppBar>
        <Box
          component="main"
          id="main-content"
          tabIndex={-1}
          sx={{ p: { xs: 2, md: 3 }, maxWidth: 1440, mx: 'auto' }}
        >
          <Outlet
            key={
              location.pathname === '/applications/new'
                ? `${programme?.id}:${intakeYear}`
                : undefined
            }
          />
        </Box>
      </Box>
    </Box>
  )
}
