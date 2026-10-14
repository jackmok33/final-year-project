# Frontend behaviour review — 14 October 2026

**Subsequent MVP decision (14 October 2026):** the user deferred criteria editing,
document updates and the other additions below. Criteria are now read-only for all
accounts, and the demo service rejects publication. Existing data/history remain
intact. This review is a completed-system backlog comparison, not an instruction
to implement these extra features during the MVP.

Compared the current implementation with [project-requirements.md](../project-requirements.md).
This is a code review, not an implementation change or a new test-verification
record. The requirements describe the completed system; the current app remains
a browser-persistent frontend demo. The existing folder structure and four-column
application queue can be retained.

## Required frontend changes

### 1. Owners must be able to manage their own criteria — FR-T02

At the time of review, the criteria page checked only `user.canPublishCriteria`; the demo service used
the same account-wide flag. Consequently, tutor B can create a workspace but
cannot edit or publish its criteria. Ownership is already available as
`Programme.createdBy`, but it is not used by criteria permissions.

Use assigned tutor access plus either ownership or shared-programme
criteria-management permission, in both the UI and service. Ownership should
allow management of that programme without granting administrator permission or
publication rights over unrelated shared programmes. Keep criteria validation
and immutable published versions.

The requirement explicitly establishes owner access and permission for shared
programmes. Programme-specific permission grants are the recommended design if
shared programmes can have different permissions; the existing global checkbox
currently grants publication across every assigned programme.

Evidence: [CriteriaPage.tsx](src/pages/CriteriaPage.tsx:11),
[publication guard](src/services/demo.ts:475),
[administrator permission controls](src/components/admin/UserPermissions.tsx:38).

### 2. Add or replace documents on existing applications — FR-T05, FR-T09, FR-S06

Uploads exist only during application creation. Assessment actions allow viewing,
decision recording and re-evaluation, with no document-update action or service
command. Re-evaluating cannot resolve a missing-document case by itself.

Add an Update documents form for missing or replacement transcript/CV/statement
PDFs. Revalidate PDFs and the combined page limit, save changes atomically and
allow a new assessment. Preserve existing decisions and runs.

Before enabling replacement, make document identity immutable: save a replacement
under a new document/version ID, retain the previous PDF, and record the exact
document set on each run. Historic evidence navigation must use the selected
run's document set. An application's current document list is not enough.
Clarify whether the 100-page limit concerns the current set or retained historical
versions; the new workflow needs a consistent policy.

Evidence: [assessment actions](src/components/assessment/AssessmentActions.tsx:23),
[service command union](src/services/demo.ts:45),
[document/run models](src/domain/types.ts:42),
[evidence document selection](src/pages/EvidencePage.tsx:24).

### 3. Expand fact correction beyond a final grade — FR-T10

The current correction form fixes one hard-coded fact, Final weighted average,
using a number between 0 and 100 and a transcript page. `Correction.value` and
`AssessmentRun.extractedGrade` are also grade-specific. This is a working example
of correction, rather than a general extracted-information workflow.

Define the supported extracted facts with the backend, then let the tutor select
a fact and an appropriate source document/version/page. Store the fact identity,
original value and corrected value with appropriate types, reason, actor and
time. Retain the current new-run behaviour and history preservation. Do not
fabricate extracted fields for unassessed uploads.

Evidence: [fixed fact and source controls](src/components/assessment/CorrectionForm.tsx:52),
[transcript-only correction controller](src/pages/CorrectionPage.tsx:39),
[correction validation](src/services/demo.ts:376).

### 4. Give tutors scoped audit history and clearer run provenance — FR-T12, FR-S06

Tutors can select past runs and see correction/decision history. However, the
audit query is administrator-only, and no tutor screen displays relevant audit
events. History entries display reasons and times but do not display the stored
actor or clearly associate every correction/decision with its assessed run.

Add an application history section showing actor, time, action and related run,
document or criteria version. Provide a programme-scoped audit query; do not
expose the unrestricted administrator dataset to tutors. Add scope identifiers to
audit records where needed rather than guessing access from display text.

Runs already identify criteria versions but lack an explicit document-set
snapshot and model/prompt versions. Extend the view models and display provenance
for each selected run. Real model/prompt values must come from the backend;
synthetic fixtures should label their metadata as demo values.

Evidence: [audit authorisation](src/services/demo.ts:271),
[history presentation](src/components/assessment/RunHistory.tsx:33),
[run model](src/domain/types.ts:73).

### 5. Make unfinished assessment results clearly provisional — FR-T07, FR-T08, NFR-03

The queue withholds scores and recommendations for queued/running/failed runs.
The assessment page instead renders result cards for any existing run, including
queued runs. Seeded simulations precompute scores before the simulated job
finishes, so final-looking results can appear beside a processing banner.

Use consistent readiness handling in assessment details. Show progress while a
run is queued/running; if partial results are intentionally available, label them
provisional and show the final overall recommendation only when ready. Preserve
access to explicitly selected completed historical runs and keep failed-run
errors/retry actions visible. Real job timeouts and retries remain backend work.

Evidence: [assessment rendering](src/pages/AssessmentPage.tsx:45),
[unconditionally displayed result card](src/components/assessment/RecommendationSummary.tsx:22),
[precomputed demo results](src/services/seed.ts:240).

### 6. Persist and show unreadable-text/document-quality warnings — FR-S02, FR-S05

PDF inspection currently validates file type, size, opening and page count. It
does not inspect embedded text or persist a scanned/unreadable-text warning.
The viewer can show an empty-text message for one page, but that does not become
a document-quality/review flag in the application workflow.

Display backend-provided text/OCR status and document-quality flags on uploads and
assessments, with a clear Further Review path for insufficient evidence. A
readable PDF with no extractable text should not be treated as a corrupt file.
PDF.js can help with a demo text-presence check; reliable extraction, local OCR,
uncertainty and routing need the backend. Preserve the existing 20 MB and
100-page checks.

Evidence: [PDF inspection](src/services/pdf.ts:20),
[page text rendering](src/components/evidence/PdfViewer.tsx:78).

## Lower-priority additions

| Requirement          | Current behaviour                                                                         | Addition                                                                                                                                                           |
| -------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| FR-T14 — Should have | Queue filtering exists; score sorting/comparison does not.                                | Add score sorting and comparison within the same programme and criteria version. Different versions must not be ranked as equivalent. Keep the four table columns. |
| FR-T15 — Should have | Programme summaries count applications, awaiting review, final decisions and failed runs. | Add processing-time and override summaries. Base them on completed timestamps and recorded recommendation/decision pairs.                                          |
| FR-T16 — Could have  | No criteria-effect preview.                                                               | Add an explicitly hypothetical comparison that creates no recorded decision and does not alter historical runs.                                                    |
| FR-T17 — Could have  | CSV and original PDFs can be downloaded; no assessment report export exists.              | Generate a report with scores, justification, evidence, run/criteria provenance and recorded decision.                                                             |

## Existing behaviour to preserve

- Creator-only workspace deletion, affected-data confirmation, independent
  application queues, access assignments and criteria: FR-T01.
- Programme selection and workflow/recommendation filtering: FR-T03.
- Initial uploads, original PDF viewing/download and CSV export: FR-T04,
  FR-T06 and FR-T13.
- Criteria weight/threshold validation and retention of earlier criteria
  versions: the existing parts of FR-T02 and FR-S04.
- Separate AI recommendation and tutor decision; final-decision confirmation,
  override reason, critical-flag blocking and actor/time/run recording: FR-T11.
- Account creation/deactivation, role/access editing, confirmed application
  deletion and confirmed demo backup/restore: FR-A01, FR-A02 and FR-A04.
- Local persistence, atomic storage writes, duplicate-decision protection,
  responsive layouts and keyboard/accessibility support: the demo portions of
  FR-S07, NFR-03, NFR-04 and NFR-07.

These are frontend/demo capabilities, not evidence that the completed backend
requirements have already been met.

## Backend and integration boundaries

- **FR-S01:** Replace demo account selection with real authentication and server
  authorisation, including programme/criteria permission checks. The UI will
  need real sign-in, session-expiry and access-denied states.
- **FR-S03, FR-S04, FR-S05, FR-S08:** Local agents, extraction/OCR, limited
  retries, uncertainty/evidence verification, rule execution and explanations
  matching calculated outcomes require backend work. The frontend must render
  these returned states without invented assessments.
- **FR-A03, FR-S06, FR-S07, NFR-03:** Real service health, job deadlines,
  model/prompt provenance, durable server storage and server audit records are
  integration work. Keep simulation clearly labelled until implemented.
- **NFR-01, NFR-02:** IndexedDB records/PDFs and exported JSON backups are not
  encrypted by the current demo. Production needs the agreed secure storage,
  transport and deployment design. If backup remains a frontend download,
  export/import must support the chosen encrypted backup format. This is not
  solved by a cosmetic interface change or a hard-coded browser encryption key.
- **NFR-05:** Protected-characteristic exclusion is an enforced scoring/criteria
  rule. The current free-text mandatory-rule input is not a fairness control.
  The UI can restrict supported admissions evidence once the criterion schema
  is defined; backend validation must enforce it.
- **NFR-06:** Existing UI/domain/service separation remains appropriate. Add the
  backend and local AI service through the adapter boundary rather than moving
  inference into React components.
- **FR-S09:** Additional evidence types are optional future scope; they do not
  require expanding the current three sections now.

## Clarifications for the affected workflows

- Which extracted fact types are editable beyond the final grade? The requirements
  establish general correction, but do not enumerate the supported fields.
- Should tutors be able to explicitly record Further Review after a failed run?
  The demo already recommends Further Review and blocks final outcomes, but its
  decision page/service require a successful run before recording any decision.
  This is a policy clarification, not proof that the existing failure state
  violates the requirement.
- Should minimal historical action metadata survive application/workspace
  deletion? Current deletion removes related audit entries and retains a deletion
  event. FR-S06 calls for action history; retention should be settled alongside
  FR-A02 without retaining deleted document contents.

Recommended implementation order: owner criteria permissions; immutable document
versions and update workflow; scoped history/provenance; broader fact correction;
processing/document-quality presentation; then score comparison and richer summaries.
Update demo tests and persistence/backup migrations alongside behavioural/model
changes, while keeping backend-unavailable behaviour for new documents honest.
