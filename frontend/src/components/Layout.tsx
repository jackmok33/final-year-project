import { useContent } from '../hooks/useContent'
import {
  DashboardOutlined,
  DescriptionOutlined,
  CreateNewFolderOutlined,
  DeleteOutlined,
  Logout,
  Menu,
  MonitorHeartOutlined,
  PeopleOutlined,
  SettingsOutlined,
  StorageOutlined,
  TuneOutlined,
} from '@mui/icons-material'
import {
  Alert,
  AppBar,
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Stack,
  TextField,
  Toolbar,
  Typography,
} from '@mui/material'
import { useEffect, useState } from 'react'
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  admissionsApi,
  useApplicationQuery,
  useCommandMutation,
  useMeQuery,
  useWorkspaceDeletionQuery,
} from '../app/api'
import {
  selectProgramme,
  setNavigationOpen,
  signOut,
  useAppDispatch,
  useAppSelector,
} from '../app/store'
import { useWorkspace } from '../app/workspace'
import { ErrorNotice, Loading } from './common'
import { CreateWorkspaceDialog } from './workspace/CreateWorkspaceDialog'
import { DeleteWorkspaceDialog } from './workspace/DeleteWorkspaceDialog'
import type { Programme } from '../domain/types'
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
    return (
      <Navigate to={user.roles.includes('admin') ? '/admin/health' : '/applications'} replace />
    )
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
  const { data: user } = useMeQuery()
  const { programme, programmes } = useWorkspace()
  const navigate = useNavigate()
  const location = useLocation()
  const dispatch = useAppDispatch()
  const open = useAppSelector((s) => s.ui.navigationOpen)
  const [creatingWorkspace, setCreatingWorkspace] = useState(false)
  const [workspaceName, setWorkspaceName] = useState('')
  const [workspaceError, setWorkspaceError] = useState<unknown>()
  const [command, { isLoading: savingWorkspace }] = useCommandMutation()
  const [workspaceToDelete, setWorkspaceToDelete] = useState<Programme>()
  const [deletionError, setDeletionError] = useState<unknown>()
  const [deleteCommand, { isLoading: deletingWorkspace }] = useCommandMutation()
  const {
    currentData: deletionImpact,
    isFetching: checkingDeletion,
    error: impactError,
  } = useWorkspaceDeletionQuery(workspaceToDelete?.id ?? '', { skip: !workspaceToDelete })
  async function deleteWorkspace() {
    if (
      !workspaceToDelete ||
      !user ||
      deletingWorkspace ||
      checkingDeletion ||
      !deletionImpact ||
      impactError
    )
      return
    setDeletionError(undefined)
    try {
      await deleteCommand({
        op: 'deleteWorkspace',
        id: workspaceToDelete.id,
        confirmed: true,
      }).unwrap()
      dispatch(
        selectProgramme({
          userId: user.id,
          programmeId: programmes.find((p) => p.id !== workspaceToDelete.id)?.id ?? '',
        }),
      )
      dispatch(setNavigationOpen(false))
      setWorkspaceToDelete(undefined)
      navigate('/applications', { replace: true })
    } catch (error) {
      setDeletionError(error)
    }
  }
  async function createWorkspace() {
    if (!user || savingWorkspace || !workspaceName.trim() || workspaceName.trim().length > 100)
      return
    setWorkspaceError(undefined)
    try {
      const { id } = await command({ op: 'workspace', name: workspaceName.trim() }).unwrap()
      if (!id) return
      dispatch(selectProgramme({ userId: user.id, programmeId: id }))
      dispatch(setNavigationOpen(false))
      setCreatingWorkspace(false)
      navigate('/applications')
    } catch (error) {
      setWorkspaceError(error)
    }
  }
  const applicationId = /^\/applications\/([^/]+)(?:\/|$)/.exec(location.pathname)?.[1]
  const { currentData: applicationData } = useApplicationQuery(applicationId ?? '', {
    skip: !applicationId || applicationId === 'new',
  })
  const applicationProgrammeId = applicationData?.application.programmeId
  const userId = user?.id
  useEffect(() => {
    if (userId && applicationProgrammeId) {
      dispatch(selectProgramme({ userId, programmeId: applicationProgrammeId }))
    }
  }, [applicationProgrammeId, userId, dispatch])
  const isAdmin = location.pathname.startsWith('/admin')
  const items = isAdmin
    ? ([
        [content.serviceHealth, '/admin/health', <MonitorHeartOutlined />],
        [content.usersAccess, '/admin/users', <PeopleOutlined />],
        [content.programmeSettings, '/admin/programme', <SettingsOutlined />],
        [content.dataOperations, '/admin/data', <StorageOutlined />],
      ] as const)
    : ([
        [content.applications, '/applications', <DashboardOutlined />],
        [content.newApplication, '/applications/new', <DescriptionOutlined />],
        [content.admissionCriteria, '/criteria', <TuneOutlined />],
      ] as const)
  const navigation = (
    <Stack sx={{ height: '100%', p: 2.5 }} spacing={2}>
      <Box sx={{ py: 1 }}>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>
          {content.ucl}
        </Typography>
        <Typography sx={{ fontWeight: 600 }}>{content.applicationReviewWorkspace}</Typography>
      </Box>
      <Box sx={{ backgroundColor: '#FAFAFA', borderRadius: 1, p: 1.5 }}>
        {isAdmin ? (
          <>
            <Typography variant="body2" color="text.secondary">
              {content.administration}
            </Typography>
            <Typography sx={{ fontWeight: 600 }}>{content.systemManagement}</Typography>
          </>
        ) : (
          <>
            <TextField
              select
              fullWidth
              label={content.programmeWorkspace}
              value={programme?.id ?? ''}
              disabled={!programmes.length}
              onChange={(event) => {
                if (!user) return
                dispatch(selectProgramme({ userId: user.id, programmeId: event.target.value }))
                dispatch(setNavigationOpen(false))
                navigate('/applications')
              }}
              sx={{ '& .MuiSelect-select': { whiteSpace: 'normal' } }}
            >
              {programmes.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.name}
                </MenuItem>
              ))}
            </TextField>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {programmes.length
                ? content.assignedCourse(programmes.length)
                : content.noAssignedCourses}
            </Typography>
            <Button
              startIcon={<CreateNewFolderOutlined />}
              onClick={() => {
                setWorkspaceName('')
                setWorkspaceError(undefined)
                setCreatingWorkspace(true)
              }}
              sx={{ mt: 1 }}
            >
              {content.newWorkspace}
            </Button>
            {programme?.createdBy === user?.id && programme && (
              <Button
                startIcon={<DeleteOutlined />}
                color="error"
                sx={{ mt: 1 }}
                onClick={() => {
                  setDeletionError(undefined)
                  setWorkspaceToDelete(programme)
                }}
              >
                {content.deleteWorkspace}
              </Button>
            )}
          </>
        )}
      </Box>
      <List component="div" disablePadding>
        {items.map(([label, path, icon]) => {
          const selected =
            path === '/applications'
              ? location.pathname === path ||
                (location.pathname.startsWith('/applications/') &&
                  location.pathname !== '/applications/new')
              : location.pathname === path
          return (
            <ListItemButton
              key={path}
              component={Link}
              to={path}
              selected={selected}
              onClick={() => dispatch(setNavigationOpen(false))}
              sx={{
                borderRadius: 1,
                mb: 0.5,
                '&.Mui-selected': { bgcolor: '#EEDEFF', color: '#361A54' },
              }}
            >
              <ListItemIcon sx={{ minWidth: 32, color: 'inherit' }}>{icon}</ListItemIcon>
              <ListItemText
                primary={label}
                slotProps={{ primary: { sx: { fontSize: 14, fontWeight: selected ? 600 : 400 } } }}
              />
            </ListItemButton>
          )
        })}
      </List>
      {user?.roles.length === 2 && (
        <Button component={Link} to={isAdmin ? '/applications' : '/admin/health'}>
          {content.switchToWorkspace(isAdmin ? content.tutorWorkspace : content.adminWorkspace)}
        </Button>
      )}
      <Box sx={{ flexGrow: 1 }} />
      <Alert severity="info" icon={false} sx={{ bgcolor: '#EEDEFF', color: '#361A54' }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {content.syntheticWorkspace}
        </Typography>
        <Typography variant="body2">{content.demoNotice}</Typography>
      </Alert>
      <Divider />
      <Box>
        <Typography sx={{ fontWeight: 600 }}>
          {isAdmin ? content.websiteAdministrator : content.admissionsTutor}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {user?.name}
        </Typography>
      </Box>
      <Button
        startIcon={<Logout />}
        sx={{ justifyContent: 'flex-start' }}
        onClick={() => {
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
      <Box
        component="nav"
        aria-label={content.workspaceNavigation}
        sx={{ width: { md: 232 }, flexShrink: { md: 0 } }}
      >
        <Drawer
          variant="permanent"
          sx={{ display: { xs: 'none', md: 'block' }, '& .MuiDrawer-paper': { width: 232 } }}
        >
          {navigation}
        </Drawer>
        <Drawer
          variant="temporary"
          open={open}
          onClose={() => dispatch(setNavigationOpen(false))}
          sx={{ display: { md: 'none' }, '& .MuiDrawer-paper': { width: 260 } }}
        >
          {navigation}
        </Drawer>
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <AppBar
          position="sticky"
          elevation={0}
          sx={{ bgcolor: '#361A54', color: '#FFF', height: 72 }}
        >
          <Toolbar sx={{ minHeight: '72px !important', gap: 2 }}>
            <IconButton
              sx={{ display: { md: 'none' }, color: '#FFF' }}
              aria-label={content.openNavigation}
              onClick={() => dispatch(setNavigationOpen(true))}
            >
              <Menu />
            </IconButton>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography>
                {content.headerTitle(
                  isAdmin ? content.administration : content.admissions,
                  items.find(([, path]) => location.pathname === path)?.[0] ??
                    content.applicationReview,
                )}
              </Typography>
              {!isAdmin && programme && (
                <Typography variant="body2" noWrap sx={{ color: '#EEDEFF' }}>
                  {programme.name}
                </Typography>
              )}
            </Box>
            <Typography
              variant="body2"
              sx={{ display: { xs: 'none', sm: 'block' }, color: '#DDbdFF' }}
            >
              {programme ? content.intake(programme.year) : content.demoEnvironment}
            </Typography>
          </Toolbar>
        </AppBar>
        <Box
          component="main"
          id="main-content"
          tabIndex={-1}
          sx={{ p: { xs: 2, md: 4 }, maxWidth: 1600, mx: 'auto' }}
        >
          <Outlet key={location.pathname === '/applications/new' ? programme?.id : undefined} />
        </Box>
      </Box>
      <CreateWorkspaceDialog
        open={creatingWorkspace}
        name={workspaceName}
        saving={savingWorkspace}
        error={workspaceError}
        onNameChange={(name) => {
          setWorkspaceName(name)
          setWorkspaceError(undefined)
        }}
        onClose={() => setCreatingWorkspace(false)}
        onSubmit={() => void createWorkspace()}
      />
      <DeleteWorkspaceDialog
        programme={workspaceToDelete}
        impact={impactError ? undefined : deletionImpact}
        loading={checkingDeletion}
        busy={deletingWorkspace}
        error={impactError ?? deletionError}
        onClose={() => setWorkspaceToDelete(undefined)}
        onConfirm={() => void deleteWorkspace()}
      />
    </Box>
  )
}
