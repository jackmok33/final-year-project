import { brandingContent } from './branding.content'
import { uploadBatchesPageContent } from './pages/UploadBatchesPage.content'
import { batchListContent } from './components/batches/BatchList.content'
import { zipUploadPanelContent } from './components/batches/ZipUploadPanel.content'
import { moduleCardsContent } from './components/workspace/ModuleCards.content'
import { intakeCardsContent } from './components/workspace/IntakeCards.content'
import { modulesPageContent } from './pages/ModulesPage.content'
import { moduleIntakesPageContent } from './pages/ModuleIntakesPage.content'
import { createWorkspaceDialogContent } from './components/workspace/CreateWorkspaceDialog.content'
import { deleteWorkspaceDialogContent } from './components/workspace/DeleteWorkspaceDialog.content'
import { queueSummaryContent } from './components/applications/QueueSummary.content'
import { healthSummaryContent } from './components/admin/HealthSummary.content'
import { domainLabelsContent } from './domain/types.content'
import { layoutContent } from './components/Layout.content'
import { accountsTableContent } from './components/admin/AccountsTable.content'
import { backupRecoveryContent } from './components/admin/BackupRecovery.content'
import { dataOperationConfirmationContent } from './components/admin/DataOperationConfirmation.content'
import { failedAttemptsContent } from './components/admin/FailedAttempts.content'
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
import { assessmentActionsContent } from './components/assessment/AssessmentActions.content'
import { correctionFormContent } from './components/assessment/CorrectionForm.content'
import { correctionGuidanceContent } from './components/assessment/CorrectionGuidance.content'
import { decisionFormContent } from './components/assessment/DecisionForm.content'
import { decisionRecordContent } from './components/assessment/DecisionRecord.content'
import { outcomeOptionsContent } from './components/assessment/OutcomeOptions.content'
import { recommendationSummaryContent } from './components/assessment/RecommendationSummary.content'
import { reviewFlagsContent } from './components/assessment/ReviewFlags.content'
import { runHistoryContent } from './components/assessment/RunHistory.content'
import { sectionAssessmentsContent } from './components/assessment/SectionAssessments.content'
import { demoSignInContent } from './components/auth/DemoSignIn.content'
import { signInIntroContent } from './components/auth/SignInIntro.content'
import { commonContent } from './components/common.content'
import { criteriaFieldsContent } from './components/criteria/CriteriaFields.content'
import { criteriaFormContent } from './components/criteria/CriteriaForm.content'
import { criteriaHistoryContent } from './components/criteria/CriteriaHistory.content'
import { documentNavigationContent } from './components/evidence/DocumentNavigation.content'
import { evidenceClaimContent } from './components/evidence/EvidenceClaim.content'
import { evidenceLinkContent } from './components/evidence/EvidenceLink.content'
import { pdfViewerContent } from './components/evidence/PdfViewer.content'
import { applicationsPageContent } from './pages/ApplicationsPage.content'
import { assessmentPageContent } from './pages/AssessmentPage.content'
import { correctionPageContent } from './pages/CorrectionPage.content'
import { criteriaPageContent } from './pages/CriteriaPage.content'
import { dataOperationsPageContent } from './pages/DataOperationsPage.content'
import { decisionPageContent } from './pages/DecisionPage.content'
import { evidencePageContent } from './pages/EvidencePage.content'
import { newApplicationPageContent } from './pages/NewApplicationPage.content'
import { programmeSettingsPageContent } from './pages/ProgrammeSettingsPage.content'
import { serviceHealthPageContent } from './pages/ServiceHealthPage.content'
import { usersAccessPageContent } from './pages/UsersAccessPage.content'

export const content = {
  uploadBatchesPage: uploadBatchesPageContent,
  batchList: batchListContent,
  zipUploadPanel: zipUploadPanelContent,
  moduleCards: moduleCardsContent,
  intakeCards: intakeCardsContent,
  modulesPage: modulesPageContent,
  moduleIntakesPage: moduleIntakesPageContent,
  createWorkspaceDialog: createWorkspaceDialogContent,
  deleteWorkspaceDialog: deleteWorkspaceDialogContent,
  branding: brandingContent,
  queueSummary: queueSummaryContent,
  healthSummary: healthSummaryContent,
  domainLabels: domainLabelsContent,
  layout: layoutContent,
  accountsTable: accountsTableContent,
  backupRecovery: backupRecoveryContent,
  dataOperationConfirmation: dataOperationConfirmationContent,
  failedAttempts: failedAttemptsContent,
  maintenanceActivity: maintenanceActivityContent,
  programmeAccess: programmeAccessContent,
  programmeForm: programmeFormContent,
  retentionDeletion: retentionDeletionContent,
  serviceAvailability: serviceAvailabilityContent,
  userForm: userFormContent,
  userPermissions: userPermissionsContent,
  applicationFilters: applicationFiltersContent,
  applicationTable: applicationTableContent,
  documentUpload: documentUploadContent,
  newApplicationForm: newApplicationFormContent,
  uploadGuidance: uploadGuidanceContent,
  assessmentActions: assessmentActionsContent,
  correctionForm: correctionFormContent,
  correctionGuidance: correctionGuidanceContent,
  decisionForm: decisionFormContent,
  decisionRecord: decisionRecordContent,
  outcomeOptions: outcomeOptionsContent,
  recommendationSummary: recommendationSummaryContent,
  reviewFlags: reviewFlagsContent,
  runHistory: runHistoryContent,
  sectionAssessments: sectionAssessmentsContent,
  demoSignIn: demoSignInContent,
  signInIntro: signInIntroContent,
  common: commonContent,
  criteriaFields: criteriaFieldsContent,
  criteriaForm: criteriaFormContent,
  criteriaHistory: criteriaHistoryContent,
  documentNavigation: documentNavigationContent,
  evidenceClaim: evidenceClaimContent,
  evidenceLink: evidenceLinkContent,
  pdfViewer: pdfViewerContent,
  applicationsPage: applicationsPageContent,
  assessmentPage: assessmentPageContent,
  correctionPage: correctionPageContent,
  criteriaPage: criteriaPageContent,
  dataOperationsPage: dataOperationsPageContent,
  decisionPage: decisionPageContent,
  evidencePage: evidencePageContent,
  newApplicationPage: newApplicationPageContent,
  programmeSettingsPage: programmeSettingsPageContent,
  serviceHealthPage: serviceHealthPageContent,
  usersAccessPage: usersAccessPageContent,
} as const

export type ContentKey = keyof typeof content
