import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import Loader from './mantis/components/Loader'
import { useContent } from './hooks/useContent'
const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })))
const ModulesPage = lazy(() =>
  import('./pages/ModulesPage').then((m) => ({ default: m.ModulesPage })),
)
const ApplicationsPage = lazy(() =>
  import('./pages/ApplicationsPage').then((m) => ({ default: m.ApplicationsPage })),
)
const UploadBatchesPage = lazy(() =>
  import('./pages/UploadBatchesPage').then((m) => ({ default: m.UploadBatchesPage })),
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
  const content = useContent('common')
  return (
    <Suspense fallback={<Loader label={content.loadingLabel} />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/modules" element={<ModulesPage />} />
            <Route path="/applications" element={<ApplicationsPage />} />
            <Route path="/batches" element={<UploadBatchesPage />} />
            <Route path="/batches/:batchId" element={<ApplicationsPage />} />
            <Route path="/applications/new" element={<NewApplicationPage />} />
            <Route path="/applications/:id" element={<AssessmentPage />} />
            <Route path="/applications/:id/evidence" element={<AssessmentPage />} />
            <Route path="/applications/:id/correct" element={<CorrectionPage />} />
            <Route path="/applications/:id/decision" element={<AssessmentPage />} />
            <Route path="/criteria" element={<UploadBatchesPage />} />
          </Route>
        </Route>
        <Route element={<ProtectedRoute admin />}>
          <Route element={<Layout />}>
            <Route path="/admin/health" element={<ServiceHealthPage />} />
            <Route path="/admin/users" element={<UsersAccessPage />} />
            <Route path="/admin/programme" element={<ProgrammeSettingsPage />} />
            <Route path="/admin/data" element={<DataOperationsPage />} />
          </Route>
        </Route>
        <Route path="/" element={<Navigate to="/modules" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
