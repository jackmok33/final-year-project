import { useContent } from '../hooks/useContent'
import { ArrowBackOutlined } from '@mui/icons-material'
import { Alert, Button, Stack, Typography } from '@mui/material'
import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { errorMessage, useApplicationQuery } from '../app/api'
import { useAppSelector } from '../app/store'
import { Card, ErrorNotice, Loading, Page, Status, TwoColumns } from '../components/common'
import { DocumentNavigation } from '../components/evidence/DocumentNavigation'
import { EvidenceClaim } from '../components/evidence/EvidenceClaim'
import { PdfViewer } from '../components/evidence/PdfViewer'
import { downloadBlob } from '../components/files'
import { latestRun } from '../domain/types'
import { authorizedFile } from '../services/demo'

export function EvidencePage() {
  const content = useContent('evidencePage')
  const { id = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const { data, error, isLoading } = useApplicationQuery(id)
  const userId = useAppSelector((s) => s.session.userId)
  const [downloadError, setDownloadError] = useState('')
  if (isLoading) return <Loading />
  if (!data) return <ErrorNotice error={error} />
  const doc = params.has('document')
    ? data.documents.find((d) => d.id === params.get('document'))
    : (data.documents.find((d) => d.type === 'transcript') ?? data.documents[0])
  const page = Number(
    params.get('page') ?? (doc?.type === 'transcript' ? Math.min(2, doc.pages) : 1),
  )
  const run = params.has('run')
    ? data.application.runs.find((r) => r.id === params.get('run'))
    : latestRun(data.application)
  const valid =
    doc && Number.isInteger(page) && page >= 1 && page <= doc.pages && (!params.has('run') || !!run)
  const citation = run?.justification.citations.find(
    (c) => c.documentId === doc?.id && c.page === page,
  )
  async function download() {
    if (!doc) return
    setDownloadError('')
    try {
      downloadBlob(await authorizedFile(doc.id, userId), doc.name)
    } catch (error) {
      setDownloadError(errorMessage(error))
    }
  }
  const changePage = (n: number) => {
    if (doc) setParams({ document: doc.id, page: String(n), ...(run ? { run: run.id } : {}) })
  }
  return (
    <Page
      title={content.sourceEvidence}
      subtitle={content.subtitle(id)}
      actions={
        <>
          <Status label={content.originalDocument} />
          <Button onClick={() => void download()} disabled={!valid}>
            {content.downloadOriginal}
          </Button>
          <Button
            component={Link}
            to={`/applications/${id}`}
            variant="outlined"
            startIcon={<ArrowBackOutlined />}
          >
            {content.back}
          </Button>
        </>
      }
    >
      <ErrorNotice error={downloadError} />
      {!valid ? (
        <Alert severity="error">{content.invalidCitationMessage}</Alert>
      ) : (
        <TwoColumns>
          <Card title={doc.name}>
            <DocumentNavigation
              documents={data.documents}
              doc={doc}
              page={page}
              onDocumentChange={(document) => setParams({ document, page: '1' })}
              changePage={changePage}
            />
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <Button disabled={page <= 1} onClick={() => changePage(page - 1)}>
                {content.previousPage}
              </Button>
              <Typography variant="body2">{content.pagePosition(page, doc.pages)}</Typography>
              <Button disabled={page >= doc.pages} onClick={() => changePage(page + 1)}>
                {content.nextPage}
              </Button>
            </Stack>
            <PdfViewer key={doc.id} document={doc} page={page} userId={userId} />
          </Card>
          <EvidenceClaim citation={citation} run={run} doc={doc} page={page} id={id} />
        </TwoColumns>
      )}
    </Page>
  )
}
