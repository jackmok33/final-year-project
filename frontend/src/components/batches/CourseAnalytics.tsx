import { Box, LinearProgress, List, ListItem, ListItemText, Stack, Typography } from '@mui/material'
import { useContent } from '../../hooks/useContent'

export interface AnalyticsCounts {
  unconditional: number
  conditional: number
  reject: number
  pending: number
}

export function CourseAnalytics({ counts, total }: { counts: AnalyticsCounts; total: number }) {
  const content = useContent('courseAnalytics')
  const groups = [
    { label: content.unconditional, count: counts.unconditional },
    { label: content.conditional, count: counts.conditional },
    { label: content.reject, count: counts.reject },
    { label: content.pendingDecision, count: counts.pending },
  ]
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" component="h2">
        {content.analyticsTitle}
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 1 }}>
        {content.analyticsDescription}
      </Typography>
      {!total ? (
        <Typography sx={{ py: 3 }}>{content.noData}</Typography>
      ) : (
        <List sx={{ maxWidth: 760 }}>
          {groups.map((group) => (
            <ListItem key={group.label} disableGutters divider>
              <Stack sx={{ width: '100%', gap: 1, py: 1 }}>
                <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                  <ListItemText primary={group.label} />
                  <Typography>{group.count}</Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={(group.count / total) * 100}
                  aria-label={group.label}
                />
              </Stack>
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  )
}
