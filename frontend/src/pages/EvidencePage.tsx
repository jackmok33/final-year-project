import { Button, Box, Stack, Typography } from '@mui/material'
import DownloadOutlined from '@ant-design/icons/DownloadOutlined'
import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useApplicationQuery } from '../app/api'
import { useAppSelector } from '../hooks/redux'
import { ErrorNotice, Loading } from '../components/common'
import { DocumentNavigation } from '../components/evidence/DocumentNavigation'
import { PdfViewer } from '../components/evidence/PdfViewer'
import { downloadBlob } from '../components/files'
import { latestRun } from '../domain/types'
import { admissionsService } from '../services/admissions'
import { errorMessage } from '../services/errors'
import { useContent } from '../hooks/useContent'
import MainCard from '../mantis/components/MainCard'

export function EvidencePage() {
  const content = useContent('evidencePage')
  const { id = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const { currentData: data, error } = useApplicationQuery(id)
  const userId = useAppSelector((s) => s.session.userId)
  const [downloadError, setDownloadError] = useState('')
  if (!data) return error ? <ErrorNotice error={error} /> : <Loading />
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
  const changePage = (next: number) => {
    if (doc) setParams({ document: doc.id, page: String(next), ...(run ? { run: run.id } : {}) })
  }
  async function download() {
    if (!doc) return
    setDownloadError('')
    try {
      downloadBlob(await admissionsService.originalDocument(doc.id, userId), doc.name)
    } catch (error) {
      setDownloadError(errorMessage(error))
    }
  }
  return (
    <Box sx={{ p: 3, maxWidth: 820, mx: 'auto' }}>
      <ErrorNotice error={downloadError} />
      {!valid ? (
        <ErrorNotice error={content.invalidCitationMessage} />
      ) : (
        <MainCard
          title={doc.name}
          secondary={
            <Button
              onClick={() => void download()}
              aria-label={content.downloadOriginal}
              startIcon={<DownloadOutlined aria-hidden="true" />}
            >
              {content.downloadOriginal}
            </Button>
          }
        >
          <Stack spacing={3}>
            <DocumentNavigation
              documents={data.documents}
              doc={doc}
              page={page}
              onDocumentChange={(document) =>
                setParams({ document, page: '1', ...(run ? { run: run.id } : {}) })
              }
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
          </Stack>
        </MainCard>
      )}
    </Box>
  )
}
