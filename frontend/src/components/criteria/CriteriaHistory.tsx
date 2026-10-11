import { useContent } from '../../hooks/useContent'
import { Stack, Typography } from '@mui/material'
import { type Rubric } from '../../domain/types'
import { Card } from '../common'
import { displayTime } from '../files'

export function CriteriaHistory({ history, active }: { history: Rubric[]; active: Rubric }) {
  const content = useContent('criteriaHistory')
  return (
    <Card title={content.versionHistory}>
      {history.toReversed().map((r) => (
        <Stack
          key={r.id}
          direction="row"
          sx={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}
        >
          <Typography sx={{ fontWeight: 600 }}>
            {content.versionStatus(r.version, r.id === active.id)}
          </Typography>
          <Typography variant="body2">
            {content.versionDetails(displayTime(r.createdAt), r)}
          </Typography>
        </Stack>
      ))}
    </Card>
  )
}
