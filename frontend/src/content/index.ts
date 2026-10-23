import { brandingContent } from './branding.content'
import { accountsTableContent } from './components/admin/AccountsTable.content'
import { backupRecoveryContent } from './components/admin/BackupRecovery.content'
import { dataOperationConfirmationContent } from './components/admin/DataOperationConfirmation.content'
import { failedAttemptsContent } from './components/admin/FailedAttempts.content'
import { healthSummaryContent } from './components/admin/HealthSummary.content'
import { maintenanceActivityContent } from './components/admin/MaintenanceActivity.content'
import { programmeAccessContent } from './components/admin/ProgrammeAccess.content'
import { programmeFormContent } from './components/admin/ProgrammeForm.content'
import { retentionDeletionContent } from './components/admin/RetentionDeletion.content'
import { serviceAvailabilityContent } from './components/admin/ServiceAvailability.content'
import { userFormContent } from './components/admin/UserForm.content'
import { userPermissionsContent } from './components/admin/UserPermissions.content'
import { applicationFiltersContent } from './components/applications/ApplicationFilters.content'
import { applicationTableContent } from './components/applications/ApplicationTable.content'
import { documentUploadContent } from './components/applications/DocumentUpload.content'
import { newApplicationFormContent } from './components/applications/NewApplicationForm.content'
import { uploadGuidanceContent } from './components/applications/UploadGuidance.content'
import { correctionFormContent } from './components/assessment/CorrectionForm.content'
import { correctionGuidanceContent } from './components/assessment/CorrectionGuidance.content'
import { decisionFormContent } from './components/assessment/DecisionForm.content'
import { evidenceSummaryContent } from './components/assessment/EvidenceSummary.content'
import { outcomeOptionsContent } from './components/assessment/OutcomeOptions.content'
import { recommendationPanelContent } from './components/assessment/RecommendationPanel.content'
import { recommendationSummaryContent } from './components/assessment/RecommendationSummary.content'
import { reviewFlagsContent } from './components/assessment/ReviewFlags.content'
import { sectionAssessmentsContent } from './components/assessment/SectionAssessments.content'
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
import { evidenceLinkContent } from './components/evidence/EvidenceLink.content'
import { pdfViewerContent } from './components/evidence/PdfViewer.content'
import { layoutContent } from './components/Layout.content'
import { workspaceHeaderContent } from './components/layout/WorkspaceHeader.content'
import { workspaceNavigationContent } from './components/layout/WorkspaceNavigation.content'
import { createWorkspaceDialogContent } from './components/workspace/CreateWorkspaceDialog.content'
import { moduleCardsContent } from './components/workspace/ModuleCards.content'
import { domainLabelsContent } from './domain/types.content'
import { applicationsPageContent } from './pages/ApplicationsPage.content'
import { assessmentPageContent } from './pages/AssessmentPage.content'
import { correctionPageContent } from './pages/CorrectionPage.content'
import { criteriaPageContent } from './pages/CriteriaPage.content'
import { dataOperationsPageContent } from './pages/DataOperationsPage.content'
import { decisionPageContent } from './pages/DecisionPage.content'
import { evidencePageContent } from './pages/EvidencePage.content'
import { loginPageContent } from './pages/LoginPage.content'
import { modulesPageContent } from './pages/ModulesPage.content'
import { newApplicationPageContent } from './pages/NewApplicationPage.content'
import { programmeSettingsPageContent } from './pages/ProgrammeSettingsPage.content'
import { serviceHealthPageContent } from './pages/ServiceHealthPage.content'
import { uploadBatchesPageContent } from './pages/UploadBatchesPage.content'
import { usersAccessPageContent } from './pages/UsersAccessPage.content'

export const content = {
  accountsTable: accountsTableContent,
  applicationFilters: applicationFiltersContent,
  applicationsPage: applicationsPageContent,
  applicationTable: applicationTableContent,
  assessmentPage: assessmentPageContent,
  backupRecovery: backupRecoveryContent,
  batchList: batchListContent,
  branding: brandingContent,
  common: commonContent,
  correctionForm: correctionFormContent,
  correctionGuidance: correctionGuidanceContent,
  correctionPage: correctionPageContent,
  courseAnalytics: courseAnalyticsContent,
  createWorkspaceDialog: createWorkspaceDialogContent,
  criteriaFields: criteriaFieldsContent,
  criteriaForm: criteriaFormContent,
  criteriaPage: criteriaPageContent,
  dataOperationConfirmation: dataOperationConfirmationContent,
  dataOperationsPage: dataOperationsPageContent,
  decisionForm: decisionFormContent,
  decisionPage: decisionPageContent,
  demoSignIn: demoSignInContent,
  documentNavigation: documentNavigationContent,
  documentUpload: documentUploadContent,
  domainLabels: domainLabelsContent,
  evidenceLink: evidenceLinkContent,
  evidencePage: evidencePageContent,
  evidenceSummary: evidenceSummaryContent,
  failedAttempts: failedAttemptsContent,
  healthSummary: healthSummaryContent,
  layout: layoutContent,
  loginPage: loginPageContent,
  maintenanceActivity: maintenanceActivityContent,
  moduleCards: moduleCardsContent,
  modulesPage: modulesPageContent,
  newApplicationForm: newApplicationFormContent,
  newApplicationPage: newApplicationPageContent,
  outcomeOptions: outcomeOptionsContent,
  pdfViewer: pdfViewerContent,
  programmeAccess: programmeAccessContent,
  programmeForm: programmeFormContent,
  programmeSettingsPage: programmeSettingsPageContent,
  protectedRoute: protectedRouteContent,
  recommendationPanel: recommendationPanelContent,
  recommendationSummary: recommendationSummaryContent,
  retentionDeletion: retentionDeletionContent,
  reviewFlags: reviewFlagsContent,
  sectionAssessments: sectionAssessmentsContent,
  serviceAvailability: serviceAvailabilityContent,
  serviceHealthPage: serviceHealthPageContent,
  signInIntro: signInIntroContent,
  uploadBatchesPage: uploadBatchesPageContent,
  uploadGuidance: uploadGuidanceContent,
  userForm: userFormContent,
  userPermissions: userPermissionsContent,
  usersAccessPage: usersAccessPageContent,
  workspaceHeader: workspaceHeaderContent,
  workspaceNavigation: workspaceNavigationContent,
  zipUploadPanel: zipUploadPanelContent,
} as const

export type ContentKey = keyof typeof content
