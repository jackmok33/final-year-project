import { CriteriaPage } from './CriteriaPage'
import { CourseAnalytics } from '../components/batches/CourseAnalytics'
import TabsCard from '../mantis/components/TabsCard'
import { programmeIntakeLabel } from '../domain/programmeDisplay'
import ArrowLeftOutlined from '@ant-design/icons/ArrowLeftOutlined'
import DownloadOutlined from '@ant-design/icons/DownloadOutlined'
import { Alert, Box, Button, Stack } from '@mui/material'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import {
  useApplicationsQuery,
  useBatchesQuery,
  useCommandMutation,
  useRubricsQuery,
} from '../app/api'
import { useWorkspace } from '../hooks/useWorkspace'
import { BatchList } from '../components/batches/BatchList'
import { ZipUploadPanel } from '../components/batches/ZipUploadPanel'
import { ErrorNotice, Loading, Page } from '../components/common'
import { SummaryCards } from '../components/SummaryCards'
import { applicationIntakeYear, normalizeIntakeYear } from '../domain/intakes'
import {
  applicationState,
  aiRecommendation,
  assessmentScore,
  currentDecision,
  decisionOutcome,
  latestRun,
} from '../domain/types'
import { csvCell } from '../domain/rules'
import { downloadBlob } from '../components/files'
import { useContent } from '../hooks/useContent'
import { usePagination } from '../hooks/usePagination'
import { useIsMounted } from '../hooks/useIsMounted'
import { summarizeApplications } from '../domain/applicationSummary'
import { releaseArchive, stageArchive } from '../services/fileStaging'

export function UploadBatchesPage() {
  const source = useWorkspace()
  const [params] = useSearchParams()
  const requested = params.get('programme')
  const programme = requested ? source.programmes.find((p) => p.id === requested) : source.programme
  const workspace = {
    ...source,
    programme,
    intakeYear: requested ? (params.get('intake') ?? programme?.year) : source.intakeYear,
  }
  return (
    <BatchUploadController
      key={`${workspace.programme?.id}:${workspace.intakeYear}`}
      workspace={workspace}
    />
  )
}

function BatchUploadController({ workspace }: { workspace: ReturnType<typeof useWorkspace> }) {
  const content = useContent('uploadBatchesPage')
  const location = useLocation()
  const [tabParams] = useSearchParams()
  const requestedTab = location.pathname === '/criteria' ? 'criteria' : tabParams.get('tab')
  const tab = requestedTab === 'criteria' || requestedTab === 'analytics' ? requestedTab : 'batches'
  const { programme, intakeYear, isLoading, error } = workspace
  const year = intakeYear ?? programme?.year ?? ''
  const batches = useBatchesQuery(
    { programmeId: programme?.id ?? '', intakeYear: year },
    { skip: !programme },
  )
  const pagination = usePagination(batches.currentData?.length ?? 0, 10)
  const applications = useApplicationsQuery(programme?.id ?? '', { skip: !programme })
  const criteria = useRubricsQuery(programme?.id ?? '', { skip: !programme })
  const [file, setFile] = useState<File>()
  const [uploadError, setUploadError] = useState<unknown>()
  const [command, { isLoading: busy }] = useCommandMutation()
  const navigate = useNavigate()
  const isMounted = useIsMounted()
  async function importBatch() {
    if (!file || !programme || busy) return
    const archiveId = stageArchive(file)
    setUploadError(undefined)
    try {
      const { id } = await command({
        op: 'importBatch',
        programmeId: programme.id,
        intakeYear: year,
        archiveId,
      }).unwrap()
      if (isMounted() && id) navigate(`/batches/${encodeURIComponent(id)}`)
    } catch (error) {
      if (isMounted()) setUploadError(error || content.importError)
    } finally {
      releaseArchive(archiveId)
    }
  }
  if (isLoading) return <Loading />
  if (error) return <ErrorNotice error={error} />
  if (!programme) return <Alert severity="info">{content.noWorkspace}</Alert>
  const currentYear = normalizeIntakeYear(year) ?? year
  const courseApplications = applications.currentData?.filter(
    (application) => application.programmeId === programme.id,
  )
  const intakeApplications = courseApplications?.filter(
    (application) => applicationIntakeYear(application, programme) === currentYear,
  )
  const summary = summarizeApplications(intakeApplications ?? [])
  const sortedBatches = [...(batches.currentData ?? [])].sort((a, b) => b.sequence - a.sequence)
  const pagedBatches = sortedBatches.slice(pagination.startIndex, pagination.endIndex)
  function exportCsv() {
    if (
      !programme ||
      !courseApplications?.length ||
      applications.error ||
      criteria.error ||
      !criteria.currentData
    )
      return
    const rows: unknown[][] = [
      [
        content.application,
        content.candidate,
        content.programme,
        content.intakeYear,
        content.state,
        content.overallScore,
        content.recommendation,
        content.tutorDecision,
        content.criteriaVersion,
      ],
    ]
    courseApplications.forEach((a) => {
      const run = latestRun(a)
      rows.push([
        a.id,
        a.candidate,
        programme.code,
        applicationIntakeYear(a, programme),
        applicationState(a),
        assessmentScore(a),
        aiRecommendation(run),
        decisionOutcome(currentDecision(a)?.outcome),
        criteria.currentData?.rubrics.find((r) => r.id === run?.rubricId)?.version,
      ])
    })
    downloadBlob(
      new Blob(['\uFEFF' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n')], {
        type: 'text/csv;charset=utf-8',
      }),
      content.exportFilename,
    )
  }
  return (
    <Page
      title={programmeIntakeLabel(programme, year)}
      actions={
        <Button component={Link} to="/modules" startIcon={<ArrowLeftOutlined aria-hidden="true" />}>
          {content.back}
        </Button>
      }
    >
      <ErrorNotice error={criteria.error} />
      <TabsCard
        value={tab}
        onChange={(next) =>
          navigate(
            `/batches?${new URLSearchParams({ programme: programme.id, intake: year, tab: next })}`,
          )
        }
        label={content.tabs}
        action={
          <Button
            variant="outlined"
            startIcon={<DownloadOutlined aria-hidden="true" />}
            onClick={exportCsv}
            disabled={
              !courseApplications?.length ||
              applications.isFetching ||
              !!applications.error ||
              !criteria.currentData ||
              criteria.isFetching ||
              !!criteria.error
            }
          >
            {content.export}
          </Button>
        }
        tabs={[
          {
            value: 'batches',
            label: content.batches,
            content: (
              <Stack spacing={2.5} sx={{ p: 2.5 }}>
                <Box component="section" aria-label={content.overview}>
                  {applications.error ? (
                    <ErrorNotice error={applications.error} />
                  ) : applications.isLoading || !intakeApplications ? (
                    <Loading />
                  ) : (
                    <SummaryCards
                      items={[
                        {
                          label: content.total,
                          value: summary.total,
                          hint: content.totalHint,
                        },
                        { label: content.offers, value: summary.offers, hint: content.offersHint },
                        {
                          label: content.pending,
                          value: summary.pending,
                          hint: content.pendingHint,
                        },
                      ]}
                    />
                  )}
                </Box>
                <ZipUploadPanel
                  file={file}
                  busy={busy}
                  error={uploadError}
                  onSelect={(next) => {
                    setFile(next)
                    setUploadError(undefined)
                  }}
                  onImport={() => void importBatch()}
                />
                <Box>
                  <BatchList
                    batches={batches.currentData ? pagedBatches : undefined}
                    isLoading={batches.isLoading}
                    error={batches.error}
                    page={pagination.page}
                    pageSize={pagination.pageSize}
                    total={sortedBatches.length}
                    onPageChange={pagination.setPage}
                    onPageSizeChange={pagination.setPageSize}
                  />
                </Box>
              </Stack>
            ),
          },
          {
            value: 'criteria',
            label: content.criteria,
            content: (
              <Box sx={{ p: 2.5 }}>
                <CriteriaPage programmeId={programme.id} />
              </Box>
            ),
          },
          {
            value: 'analytics',
            label: content.analytics,
            content: applications.error ? (
              <ErrorNotice error={applications.error} />
            ) : intakeApplications ? (
              <CourseAnalytics counts={summary} total={summary.total} />
            ) : (
              <Loading />
            ),
          },
        ]}
      />
    </Page>
  )
}
