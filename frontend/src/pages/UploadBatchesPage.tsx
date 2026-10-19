import { ArrowBackOutlined, DownloadOutlined } from '@mui/icons-material'
import { Alert, Box, Button } from '@mui/material'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  useApplicationsQuery,
  useBatchesQuery,
  useCommandMutation,
  useRubricsQuery,
} from '../app/api'
import { useWorkspace } from '../app/workspace'
import { BatchList } from '../components/batches/BatchList'
import { ZipUploadPanel } from '../components/batches/ZipUploadPanel'
import { Card, ErrorNotice, Loading, Page } from '../components/common'
import { SummaryCards } from '../components/SummaryCards'
import { applicationIntakeYear, normalizeIntakeYear } from '../domain/intakes'
import { applicationState, currentDecision, latestDecision, latestRun } from '../domain/types'
import { csvCell } from '../domain/rules'
import { downloadBlob } from '../components/files'
import { useContent } from '../hooks/useContent'
import { releaseArchive, stageArchive } from '../services/demo'

export function UploadBatchesPage() {
  const workspace = useWorkspace()
  return (
    <BatchUploadController
      key={`${workspace.programme?.id}:${workspace.intakeYear}`}
      workspace={workspace}
    />
  )
}

function BatchUploadController({ workspace }: { workspace: ReturnType<typeof useWorkspace> }) {
  const content = useContent('uploadBatchesPage')
  const { programme, intakeYear, isLoading, error } = workspace
  const year = intakeYear ?? programme?.year ?? ''
  const batches = useBatchesQuery(
    { programmeId: programme?.id ?? '', intakeYear: year },
    { skip: !programme },
  )
  const applications = useApplicationsQuery(programme?.id ?? '', { skip: !programme })
  const criteria = useRubricsQuery(programme?.id ?? '', { skip: !programme })
  const [file, setFile] = useState<File>()
  const [uploadError, setUploadError] = useState<unknown>()
  const [command, { isLoading: busy }] = useCommandMutation()
  const navigate = useNavigate()
  const active = useRef(true)
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])
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
      if (active.current && id) navigate(`/batches/${encodeURIComponent(id)}`)
    } catch (error) {
      if (active.current) setUploadError(error || content.importError)
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
  const reviewedApplications = intakeApplications?.filter(
    (application) => !!currentDecision(application),
  )
  const offers = reviewedApplications?.filter(
    (application) => latestDecision(application)?.outcome === 'Offer',
  ).length
  function exportCsv() {
    if (
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
        programme?.code,
        applicationIntakeYear(a, programme),
        applicationState(a),
        run?.overall,
        run?.recommendation,
        latestDecision(a)?.outcome,
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
      title={content.title}
      subtitle={content.subtitle(programme.name, year)}
      actions={
        <>
          <Button
            variant="outlined"
            startIcon={<DownloadOutlined />}
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
            {content.exportResults}
          </Button>
          <Button component={Link} to="/criteria">
            {content.criteria}
          </Button>
          <Button
            component={Link}
            to={`/modules/${encodeURIComponent(programme.id)}`}
            startIcon={<ArrowBackOutlined />}
          >
            {content.back}
          </Button>
        </>
      }
    >
      <ErrorNotice error={criteria.error} />
      <Box component="section" aria-label={content.overview}>
        {applications.error ? (
          <ErrorNotice error={applications.error} />
        ) : applications.isLoading || !intakeApplications ? (
          <Loading />
        ) : (
          <SummaryCards
            items={[
              {
                label: content.totalApplicants,
                value: intakeApplications.length,
                hint: content.totalApplicantsHint,
              },
              { label: content.offers, value: offers ?? 0, hint: content.offersHint },
              {
                label: content.reviewed,
                value: content.reviewedCount(
                  reviewedApplications?.length ?? 0,
                  intakeApplications.length,
                ),
                hint: content.reviewedHint,
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
          if (next) {
            setFile(next)
            setUploadError(undefined)
          }
        }}
        onImport={() => void importBatch()}
      />
      <Card title={content.history}>
        <ErrorNotice error={batches.error} />
        {batches.isLoading ? (
          <Loading />
        ) : (
          batches.currentData && (
            <>
              <BatchList
                batches={[...batches.currentData].sort((a, b) => b.sequence - a.sequence)}
              />
              {!batches.currentData.length && <Alert severity="info">{content.empty}</Alert>}
            </>
          )
        )}
      </Card>
    </Page>
  )
}
