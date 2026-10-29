import DashboardOutlined from '@ant-design/icons/DashboardOutlined'
import TeamOutlined from '@ant-design/icons/TeamOutlined'
import SettingOutlined from '@ant-design/icons/SettingOutlined'
import DatabaseOutlined from '@ant-design/icons/DatabaseOutlined'
import { Box, Drawer, Toolbar } from '@mui/material'
import { useEffect, useState } from 'react'
import { Outlet, useLocation, useMatch, useSearchParams } from 'react-router-dom'
import {
  admissionsApi,
  useApplicationQuery,
  useBatchQuery,
  useProgrammeIntakesQuery,
} from '../app/api'
import { headerHeight, sidebarWidth } from '../app/theme'
import { selectProgramme, setNavigationOpen, signOut } from '../app/store'
import { useAppDispatch, useAppSelector } from '../hooks/redux'
import { useWorkspace } from '../hooks/useWorkspace'
import { programmeIntakeLabel } from '../domain/programmeDisplay'
import { intakeYears, normalizeIntakeYear, applicationIntakeYear } from '../domain/intakes'
import { useContent } from '../hooks/useContent'
import MiniDrawerStyled from '../mantis/layout/MiniDrawerStyled'
import CustomizedDialog from '../mantis/components/CustomizedDialog'
import { ChangePasswordForm, type PasswordDraft } from './auth/ChangePasswordForm'
import { WorkspaceHeader } from './layout/WorkspaceHeader'
import { WorkspaceNavigation, type NavigationItem } from './layout/WorkspaceNavigation'

export function Layout() {
  const content = useContent('layout')
  const { user, programme, programmes, intakeYear } = useWorkspace()
  const location = useLocation()
  const [params] = useSearchParams()
  const [accountAnchor, setAccountAnchor] = useState<HTMLElement | null>(null)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [passwordDraft, setPasswordDraft] = useState<PasswordDraft>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [passwordMessage, setPasswordMessage] = useState('')
  const { data: programmeIntakes } = useProgrammeIntakesQuery(undefined, {
    skip: !user?.roles.includes('tutor'),
  })
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
  const batchId =
    useMatch('/batches/:batchId')?.params.batchId ??
    (location.pathname === '/applications/new' ? (params.get('batch') ?? undefined) : undefined)
  const { currentData: batch } = useBatchQuery(batchId ?? '', { skip: !batchId })
  const batchProgramme = programmes.find((p) => p.id === batch?.programmeId)
  const routeProgramme = programmes.find((p) => p.id === params.get('programme'))
  const routeYear = params.get('intake')
  const validRouteYear =
    routeProgramme &&
    routeYear &&
    (normalizeIntakeYear(routeYear) ?? (routeYear === routeProgramme.year ? routeYear : undefined))
  const recordProgrammeId = applicationProgrammeId ?? batchProgramme?.id ?? routeProgramme?.id
  const recordYear = applicationYear ?? batch?.intakeYear ?? validRouteYear ?? routeProgramme?.year
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
  const currentProgramme =
    location.pathname === '/modules' ? undefined : (routeProgramme ?? programme)
  const selectedYear =
    normalizeIntakeYear(recordYear ?? intakeYear ?? programme?.year ?? '') ??
    recordYear ??
    intakeYear
  const adminItems: NavigationItem[] = [
    {
      id: '/admin/health',
      label: content.serviceHealth,
      path: '/admin/health',
      icon: <DashboardOutlined aria-hidden="true" />,
      selected: location.pathname === '/admin/health',
    },
    {
      id: '/admin/users',
      label: content.usersAccess,
      path: '/admin/users',
      icon: <TeamOutlined aria-hidden="true" />,
      selected: location.pathname === '/admin/users',
    },
    {
      id: '/admin/programme',
      label: content.programmeSettings,
      path: '/admin/programme',
      icon: <SettingOutlined aria-hidden="true" />,
      selected: location.pathname === '/admin/programme',
    },
    {
      id: '/admin/data',
      label: content.dataOperations,
      path: '/admin/data',
      icon: <DatabaseOutlined aria-hidden="true" />,
      selected: location.pathname === '/admin/data',
    },
  ]
  const navigationItems = isAdmin
    ? adminItems
    : programmes.flatMap((programme) => {
        const years =
          programmeIntakes?.find((row) => row.programmeId === programme.id)?.years ??
          intakeYears(programme, [])
        return years.map((year) => ({
          id: programme.id + ':' + year,
          label: programmeIntakeLabel(programme, year),
          path: '/batches?' + new URLSearchParams({ programme: programme.id, intake: year }),
          selected: currentProgramme?.id === programme.id && selectedYear === year,
        }))
      })
  function closeNavigation() {
    dispatch(setNavigationOpen(false))
  }
  function logout() {
    setAccountAnchor(null)
    closeNavigation()
    dispatch(signOut())
    dispatch(admissionsApi.util.resetApiState())
  }
  function closePassword() {
    setPasswordOpen(false)
    setPasswordDraft({ currentPassword: '', newPassword: '', confirmPassword: '' })
    setPasswordMessage('')
  }
  function submitPassword() {
    if (passwordDraft.newPassword !== passwordDraft.confirmPassword) {
      setPasswordMessage(content.passwordMismatch)
    } else if (passwordDraft.newPassword === passwordDraft.currentPassword) {
      setPasswordMessage(content.passwordUnchanged)
    } else {
      setPasswordMessage(content.passwordUnavailable)
    }
  }
  const navigation = (
    <WorkspaceNavigation admin={isAdmin} items={navigationItems} onNavigate={closeNavigation} />
  )
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <a className="skip-link" href="#main-content">
        {content.skipToMainContent}
      </a>
      <Box sx={{ width: { md: sidebarWidth }, flexShrink: { md: 0 } }}>
        <MiniDrawerStyled
          open
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
          }}
        >
          {navigation}
        </MiniDrawerStyled>
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
        <WorkspaceHeader
          user={user}
          admin={isAdmin}
          accountAnchor={accountAnchor}
          onOpenAccount={setAccountAnchor}
          onCloseAccount={() => setAccountAnchor(null)}
          onOpenNavigation={() => dispatch(setNavigationOpen(true))}
          onChangePassword={() => {
            setAccountAnchor(null)
            setPasswordOpen(true)
          }}
          onSignOut={logout}
        />
        <Toolbar aria-hidden="true" sx={{ minHeight: `${headerHeight}px !important` }} />
        <Box
          component="main"
          id="main-content"
          tabIndex={-1}
          sx={{ p: { xs: 2, md: 4.5 }, maxWidth: 1500, mx: 'auto' }}
        >
          <Outlet
            key={
              location.pathname === '/applications/new'
                ? `${programme?.id}:${intakeYear}:${params.get('batch') ?? ''}`
                : undefined
            }
          />
        </Box>
      </Box>
      <CustomizedDialog
        open={passwordOpen}
        title={content.changePassword}
        closeLabel={content.closePassword}
        onClose={closePassword}
      >
        <ChangePasswordForm
          values={passwordDraft}
          message={passwordMessage}
          onChange={(field, value) => {
            setPasswordDraft((draft) => ({ ...draft, [field]: value }))
            setPasswordMessage('')
          }}
          onSubmit={submitPassword}
          onCancel={closePassword}
        />
      </CustomizedDialog>
    </Box>
  )
}
