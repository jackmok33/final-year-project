import { useContent } from '../../hooks/useContent'
import { Box, Divider, Stack, TextField, Typography } from '@mui/material'
import { type Rubric, type SectionKey } from '../../domain/types'
import { Card, Status } from '../common'

export function CriteriaFields({
  rubric,
  total,
  invalidWeights,
  disabled,
  changeWeight,
  changeThreshold,
}: {
  rubric: Rubric
  total: number
  invalidWeights: boolean
  disabled: boolean
  changeWeight: (key: SectionKey, value: string) => void
  changeThreshold: (key: 'rejectBelow' | 'offerFrom' | 'margin', value: string) => void
}) {
  const content = useContent('criteriaFields')
  return (
    <Card title={content.sectionWeights}>
      {(Object.keys(content.sectionNames) as SectionKey[]).map((key) => (
        <Stack direction="row" spacing={2} key={key} sx={{ alignItems: 'center' }}>
          <TextField
            label={content.weightLabel(content.sectionNames[key])}
            type="number"
            value={Number.isNaN(rubric.weights[key]) ? '' : rubric.weights[key]}
            disabled={disabled}
            onChange={(event) => changeWeight(key, event.target.value)}
            slotProps={{ htmlInput: { min: 0, max: 100, step: 'any' } }}
          />
          <Box sx={{ flex: '0 0 25%', bgcolor: 'primary.light', height: 8, borderRadius: 1 }}>
            <Box
              sx={{
                width: `${Number.isFinite(rubric.weights[key]) ? Math.max(0, Math.min(100, rubric.weights[key])) : 0}%`,
                height: 8,
                bgcolor: 'primary.main',
                borderRadius: 1,
              }}
            />
          </Box>
        </Stack>
      ))}
      <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
        <Typography sx={{ fontWeight: 600 }}>{content.total}</Typography>
        <Status label={content.totalLabel(total, invalidWeights)} />
      </Stack>
      <Divider />
      <Typography variant="h6" component="h2">
        {content.recommendationThresholds}
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 2 }}>
        {(
          [
            ['rejectBelow', content.rejectBelow],
            ['offerFrom', content.offerFrom],
            ['margin', content.reviewMarginPoints],
          ] as const
        ).map(([key, label]) => (
          <TextField
            key={key}
            label={label}
            type="number"
            value={Number.isNaN(rubric[key]) ? '' : rubric[key]}
            disabled={disabled}
            onChange={(event) => changeThreshold(key, event.target.value)}
            slotProps={{ htmlInput: { min: 0, max: 100, step: 'any' } }}
          />
        ))}
      </Stack>
      <Typography variant="body2">{content.marginHint}</Typography>
    </Card>
  )
}
