import { useContent } from '../../hooks/useContent'
import { Box, Divider, Stack, TextField, Typography } from '@mui/material'
import { type Rubric, type SectionKey } from '../../domain/types'
import { Card, Status } from '../common'

export function CriteriaFields({ rubric, total }: { rubric: Rubric; total: number }) {
  const content = useContent('criteriaFields')
  return (
    <Card title={content.sectionWeights}>
      {(Object.keys(content.sectionNames) as SectionKey[]).map((key) => (
        <Stack direction="row" spacing={2} key={key} sx={{ alignItems: 'center' }}>
          <TextField
            label={content.weightLabel(content.sectionNames[key])}
            type="number"
            value={Number.isNaN(rubric.weights[key]) ? '' : rubric.weights[key]}
            disabled
            slotProps={{ htmlInput: { min: 0, max: 100 } }}
          />
          <Box sx={{ flex: '0 0 25%', bgcolor: '#EEDEFF', height: 8, borderRadius: 1 }}>
            <Box
              sx={{
                width: `${Math.max(0, Math.min(100, rubric.weights[key]))}%`,
                height: 8,
                bgcolor: '#993BFF',
                borderRadius: 1,
              }}
            />
          </Box>
        </Stack>
      ))}
      <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
        <Typography sx={{ fontWeight: 600 }}>{content.total}</Typography>
        <Status label={content.totalLabel(total, false)} />
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
            disabled
            slotProps={{ htmlInput: { min: 0, max: 100 } }}
          />
        ))}
      </Stack>
      <Typography variant="body2">{content.marginHint}</Typography>
      <TextField label={content.mandatoryAcademicRule} value={rubric.mandatoryRule} disabled />
    </Card>
  )
}
