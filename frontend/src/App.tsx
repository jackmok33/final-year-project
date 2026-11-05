import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import Loader from './mantis/components/Loader'
import { useContent } from './hooks/useContent'
import { PROGRAMMES_PATH } from './app/paths'
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
const UsersAccessPage = lazy(() =>
  import('./pages/UsersAccessPage').then((m) => ({ default: m.UsersAccessPage })),
)
const ServiceHealthPage = lazy(() =>
  import('./pages/ServiceHealthPage').then((m) => ({ default: m.ServiceHealthPage })),
)
const LegacyRedirectPage = lazy(() =>
  import('./pages/LegacyRedirectPage').then((m) => ({ default: m.LegacyRedirectPage })),
)
export function App() {
  const content = useContent('common')
  return (
    <Suspense fallback={<Loader label={content.loadingLabel} />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="programmes">
              <Route index element={<ModulesPage />} />
              <Route path=":programmeId">
                <Route index element={<LegacyRedirectPage destination="programme" />} />
                <Route path="intakes/:intake">
                  <Route index element={<UploadBatchesPage />} />
                  <Route path="batches/:batchId">
                    <Route index element={<ApplicationsPage />} />
                    <Route path="applications">
                      <Route path="new" element={<NewApplicationPage />} />
                      <Route path=":id">
                        <Route index element={<AssessmentPage />} />
                        <Route path="evidence" element={<AssessmentPage />} />
                        <Route path="correct" element={<AssessmentPage />} />
                        <Route path="decision" element={<AssessmentPage />} />
                      </Route>
                    </Route>
                  </Route>
                  <Route path="applications">
                    <Route index element={<ApplicationsPage />} />
                    <Route path="new" element={<NewApplicationPage />} />
                    <Route path=":id">
                      <Route index element={<AssessmentPage />} />
                      <Route path="evidence" element={<AssessmentPage />} />
                      <Route path="correct" element={<AssessmentPage />} />
                      <Route path="decision" element={<AssessmentPage />} />
                    </Route>
                  </Route>
                </Route>
              </Route>
            </Route>
            <Route path="/modules" element={<Navigate to={PROGRAMMES_PATH} replace />} />
            <Route path="/modules/:id" element={<Navigate to={PROGRAMMES_PATH} replace />} />
            <Route path="/applications" element={<LegacyRedirectPage destination="queue" />} />
            <Route path="/batches" element={<LegacyRedirectPage destination="workspace" />} />
            <Route path="/batches/:batchId" element={<LegacyRedirectPage destination="batch" />} />
            <Route path="/applications/new" element={<LegacyRedirectPage destination="new" />} />
            <Route
              path="/applications/:id"
              element={<LegacyRedirectPage destination="application" />}
            />
            <Route
              path="/applications/:id/evidence"
              element={<LegacyRedirectPage destination="application" />}
            />
            <Route
              path="/applications/:id/correct"
              element={<LegacyRedirectPage destination="application" />}
            />
            <Route
              path="/applications/:id/decision"
              element={<LegacyRedirectPage destination="application" />}
            />
            <Route path="/criteria" element={<LegacyRedirectPage destination="workspace" />} />
          </Route>
        </Route>
        <Route element={<ProtectedRoute admin />}>
          <Route element={<Layout />}>
            <Route path="/admin" element={<Navigate to="/admin/users" replace />} />
            <Route path="/admin/users" element={<UsersAccessPage />} />
            <Route path="/admin/backup" element={<Navigate to="/admin/users" replace />} />
            <Route path="/admin/health" element={<ServiceHealthPage />} />
            <Route path="/admin/programme" element={<Navigate to="/admin/users" replace />} />
            <Route path="/admin/data" element={<Navigate to="/admin/users" replace />} />
          </Route>
        </Route>
        <Route path="/" element={<Navigate to={PROGRAMMES_PATH} replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
