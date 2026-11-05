import { brandingContent } from './branding.content'
import { accountsTableContent } from './components/admin/AccountsTable.content'
import { userFormContent } from './components/admin/UserForm.content'
import { applicationFiltersContent } from './components/applications/ApplicationFilters.content'
import { applicationTableContent } from './components/applications/ApplicationTable.content'
import { documentUploadContent } from './components/applications/DocumentUpload.content'
import { newApplicationFormContent } from './components/applications/NewApplicationForm.content'
import { uploadGuidanceContent } from './components/applications/UploadGuidance.content'
import { correctionFormContent } from './components/assessment/CorrectionForm.content'
import { decisionFormContent } from './components/assessment/DecisionForm.content'
import { evidenceSummaryContent } from './components/assessment/EvidenceSummary.content'
import { outcomeOptionsContent } from './components/assessment/OutcomeOptions.content'
import { recommendationPanelContent } from './components/assessment/RecommendationPanel.content'
import { recommendationSummaryContent } from './components/assessment/RecommendationSummary.content'
import { reviewFlagsContent } from './components/assessment/ReviewFlags.content'
import { sectionAssessmentsContent } from './components/assessment/SectionAssessments.content'
import { changePasswordFormContent } from './components/auth/ChangePasswordForm.content'
import { demoSignInContent } from './components/auth/DemoSignIn.content'
import { protectedRouteContent } from './components/auth/ProtectedRoute.content'
import { signInIntroContent } from './components/auth/SignInIntro.content'
import { batchListContent } from './components/batches/BatchList.content'
import { courseAnalyticsContent } from './components/batches/CourseAnalytics.content'
import { zipUploadPanelContent } from './components/batches/ZipUploadPanel.content'
import { commonContent } from './components/common.content'
import { criteriaFieldsContent } from './components/criteria/CriteriaFields.content'
import { criteriaFormContent } from './components/criteria/CriteriaForm.content'
import { documentNavigationContent } from './components/evidence/DocumentNavigation.content'
import { pdfViewerContent } from './components/evidence/PdfViewer.content'
import { layoutContent } from './components/Layout.content'
import { workspaceHeaderContent } from './components/layout/WorkspaceHeader.content'
import { workspaceNavigationContent } from './components/layout/WorkspaceNavigation.content'
import { createWorkspaceDialogContent } from './components/workspace/CreateWorkspaceDialog.content'
import { moduleCardsContent } from './components/workspace/ModuleCards.content'
import { applicationsPageContent } from './pages/ApplicationsPage.content'
import { assessmentPageContent } from './pages/AssessmentPage.content'
import { correctionPageContent } from './pages/CorrectionPage.content'
import { criteriaPageContent } from './pages/CriteriaPage.content'
import { decisionPageContent } from './pages/DecisionPage.content'
import { evidencePageContent } from './pages/EvidencePage.content'
import { legacyRedirectPageContent } from './pages/LegacyRedirectPage.content'
import { loginPageContent } from './pages/LoginPage.content'
import { modulesPageContent } from './pages/ModulesPage.content'
import { newApplicationPageContent } from './pages/NewApplicationPage.content'
import { uploadBatchesPageContent } from './pages/UploadBatchesPage.content'
import { usersAccessPageContent } from './pages/UsersAccessPage.content'
import { serviceHealthPageContent } from './pages/ServiceHealthPage.content'

export const content = {
  accountsTable: accountsTableContent,
  applicationFilters: applicationFiltersContent,
  applicationsPage: applicationsPageContent,
  applicationTable: applicationTableContent,
  assessmentPage: assessmentPageContent,
  batchList: batchListContent,
  branding: brandingContent,
  changePasswordForm: changePasswordFormContent,
  common: commonContent,
  correctionForm: correctionFormContent,
  correctionPage: correctionPageContent,
  courseAnalytics: courseAnalyticsContent,
  createWorkspaceDialog: createWorkspaceDialogContent,
  criteriaFields: criteriaFieldsContent,
  criteriaForm: criteriaFormContent,
  criteriaPage: criteriaPageContent,
  decisionForm: decisionFormContent,
  decisionPage: decisionPageContent,
  demoSignIn: demoSignInContent,
  documentNavigation: documentNavigationContent,
  documentUpload: documentUploadContent,
  evidencePage: evidencePageContent,
  evidenceSummary: evidenceSummaryContent,
  layout: layoutContent,
  legacyRedirectPage: legacyRedirectPageContent,
  loginPage: loginPageContent,
  moduleCards: moduleCardsContent,
  modulesPage: modulesPageContent,
  newApplicationForm: newApplicationFormContent,
  newApplicationPage: newApplicationPageContent,
  outcomeOptions: outcomeOptionsContent,
  pdfViewer: pdfViewerContent,
  protectedRoute: protectedRouteContent,
  recommendationPanel: recommendationPanelContent,
  recommendationSummary: recommendationSummaryContent,
  reviewFlags: reviewFlagsContent,
  sectionAssessments: sectionAssessmentsContent,
  serviceHealthPage: serviceHealthPageContent,
  signInIntro: signInIntroContent,
  uploadBatchesPage: uploadBatchesPageContent,
  uploadGuidance: uploadGuidanceContent,
  userForm: userFormContent,
  usersAccessPage: usersAccessPageContent,
  workspaceHeader: workspaceHeaderContent,
  workspaceNavigation: workspaceNavigationContent,
  zipUploadPanel: zipUploadPanelContent,
} as const

export type ContentKey = keyof typeof content
