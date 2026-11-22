import { Alert, Button, Link, Stack, Typography } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import type { EnglishTestCheck } from '../../domain/types'
import { useContent } from '../../hooks/useContent'
import MainCard from '../../mantis/components/MainCard'
import { EnglishTestFacts } from './EnglishTestFacts'

interface EnglishTestCheckCardProps {
  check: EnglishTestCheck | null
  submitting: boolean
  sourcePath?: string
  onRun: () => void
}

export function EnglishTestCheckCard({
  check,
  submitting,
  sourcePath,
  onRun,
}: EnglishTestCheckCardProps) {
  const content = useContent('englishTestCheckCard')
  const status = check?.status
  const busy = status === 'queued' || status === 'running'

  return (
    <MainCard title={content.heading}>
      <Stack spacing={2} sx={{ alignItems: 'flex-start' }}>
        <Typography color="text.secondary">{content.demoRule}</Typography>
        {busy && (
          <Alert severity="info" role="status">
            {content[status]}
          </Alert>
        )}
        {check?.error && <Alert severity="error">{content.errors[check.error]}</Alert>}
        {check?.result && <EnglishTestFacts result={check.result} />}
        {check && sourcePath && (
          <Link component={RouterLink} to={sourcePath}>
            {content.viewPage(check.page)}
          </Link>
        )}
        <Button variant="contained" onClick={onRun} disabled={submitting || busy}>
          {status === 'failed' ? content.retry : content.run}
        </Button>
      </Stack>
    </MainCard>
  )
}
