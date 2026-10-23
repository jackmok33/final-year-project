import { Alert, AlertTitle, Button, Stack, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import type { AssessmentRun } from '../../domain/types'
import { useContent } from '../../hooks/useContent'

export function ReviewFlags({
  run,
  id,
  canCorrect,
}: {
  run: AssessmentRun
  id: string
  canCorrect: boolean
}) {
  const content = useContent('reviewFlags')
  const flags = run.flags.filter((flag) => flag.code !== 'BACKEND_UNAVAILABLE')
  return (
    <Stack spacing={3} sx={{ p: 2 }}>
      {!flags.length && <Typography color="text.secondary">{content.noFlags}</Typography>}
      {flags.map((flag) => (
        <Alert
          key={flag.code}
          severity={flag.critical ? 'warning' : 'info'}
          icon={false}
          action={
            canCorrect && flag.code === 'GRADE_MISMATCH' ? (
              <Button
                variant="outlined"
                color="secondary"
                component={Link}
                to={`/applications/${encodeURIComponent(id)}/correct`}
              >
                {content.updateDetail}
              </Button>
            ) : undefined
          }
          sx={{ py: 2 }}
        >
          <AlertTitle>
            {flag.code === 'GRADE_MISMATCH' ? content.academicMismatch : content.reviewConcern}
          </AlertTitle>
          {flag.message}
        </Alert>
      ))}
    </Stack>
  )
}
