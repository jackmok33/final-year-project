import { useContent } from '../../hooks/useContent'
import { CardActionArea, Typography } from '@mui/material'
import { type Rubric } from '../../domain/types'
import { Card } from '../common'
import { displayTime } from '../files'

export function CriteriaHistory({
  history,
  active,
  selectedVersionId,
  disabled,
  loadVersion,
}: {
  history: Rubric[]
  active: Rubric
  selectedVersionId: string
  disabled: boolean
  loadVersion: (id: string) => void
}) {
  const content = useContent('criteriaHistory')
  return (
    <Card title={content.versionHistory}>
      {history.toReversed().map((r) => (
        <CardActionArea
          key={r.id}
          type="button"
          disabled={disabled}
          aria-label={content.loadVersion(r.version)}
          aria-pressed={r.id === selectedVersionId}
          onClick={() => loadVersion(r.id)}
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 1,
            p: 1.5,
            border: 1,
            borderColor: r.id === selectedVersionId ? 'primary.main' : 'divider',
            bgcolor: r.id === selectedVersionId ? 'primary.light' : 'background.paper',
            borderRadius: 1,
            textAlign: 'left',
          }}
        >
          <Typography component="span" sx={{ fontWeight: 600 }}>
            {content.versionStatus(r.version, r.id === active.id)}
          </Typography>
          <Typography component="span" variant="body2">
            {content.versionDetails(displayTime(r.createdAt), r)}
          </Typography>
        </CardActionArea>
      ))}
    </Card>
  )
}
