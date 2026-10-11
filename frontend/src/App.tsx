import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout, Protected } from './components/Layout'
import { Loading } from './components/common'
const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })))
const ApplicationsPage = lazy(() =>
  import('./pages/ApplicationsPage').then((m) => ({ default: m.ApplicationsPage })),
)
const NewApplicationPage = lazy(() =>
  import('./pages/NewApplicationPage').then((m) => ({ default: m.NewApplicationPage })),
)
const AssessmentPage = lazy(() =>
  import('./pages/AssessmentPage').then((m) => ({ default: m.AssessmentPage })),
)
const CorrectionPage = lazy(() =>
  import('./pages/CorrectionPage').then((m) => ({ default: m.CorrectionPage })),
)
const DecisionPage = lazy(() =>
  import('./pages/DecisionPage').then((m) => ({ default: m.DecisionPage })),
)
const EvidencePage = lazy(() =>
  import('./pages/EvidencePage').then((m) => ({ default: m.EvidencePage })),
)
const CriteriaPage = lazy(() =>
  import('./pages/CriteriaPage').then((m) => ({ default: m.CriteriaPage })),
)
const DataOperationsPage = lazy(() =>
  import('./pages/DataOperationsPage').then((m) => ({ default: m.DataOperationsPage })),
)
const ServiceHealthPage = lazy(() =>
  import('./pages/ServiceHealthPage').then((m) => ({ default: m.ServiceHealthPage })),
)
const ProgrammeSettingsPage = lazy(() =>
  import('./pages/ProgrammeSettingsPage').then((m) => ({ default: m.ProgrammeSettingsPage })),
)
const UsersAccessPage = lazy(() =>
  import('./pages/UsersAccessPage').then((m) => ({ default: m.UsersAccessPage })),
)
export function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<Protected />}>
          <Route element={<Layout />}>
            <Route path="/applications" element={<ApplicationsPage />} />
            <Route path="/applications/new" element={<NewApplicationPage />} />
            <Route path="/applications/:id" element={<AssessmentPage />} />
            <Route path="/applications/:id/evidence" element={<EvidencePage />} />
            <Route path="/applications/:id/correct" element={<CorrectionPage />} />
            <Route path="/applications/:id/decision" element={<DecisionPage />} />
            <Route path="/criteria" element={<CriteriaPage />} />
          </Route>
        </Route>
        <Route element={<Protected admin />}>
          <Route element={<Layout />}>
            <Route path="/admin/health" element={<ServiceHealthPage />} />
            <Route path="/admin/users" element={<UsersAccessPage />} />
            <Route path="/admin/programme" element={<ProgrammeSettingsPage />} />
            <Route path="/admin/data" element={<DataOperationsPage />} />
          </Route>
        </Route>
        <Route path="/" element={<Navigate to="/applications" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
