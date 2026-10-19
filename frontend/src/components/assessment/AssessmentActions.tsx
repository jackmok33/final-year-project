import { useContent } from '../../hooks/useContent'
import { ArrowBackOutlined } from '@mui/icons-material'
import { Button } from '@mui/material'
import { Link } from 'react-router-dom'
import { type Application } from '../../domain/types'

export function AssessmentActions({ app, id }: { app: Application; id: string }) {
  const content = useContent('assessmentActions')
  return (
    <>
      <Button variant="outlined" component={Link} to={`/applications/${id}/evidence`}>
        {content.viewDocuments}
      </Button>
      {app.batchId && (
        <Button
          component={Link}
          to={`/batches/${encodeURIComponent(app.batchId)}`}
          startIcon={<ArrowBackOutlined />}
        >
          {content.back}
        </Button>
      )}
    </>
  )
}
