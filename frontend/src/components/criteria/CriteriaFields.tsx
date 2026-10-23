import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import type { Rubric, SectionKey } from '../../domain/types'
import { Card, Status } from '../common'
import { useContent } from '../../hooks/useContent'

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
      <Stack spacing={2.5} sx={{ maxWidth: 540 }}>
        {(Object.keys(content.sectionNames) as SectionKey[]).map((key) => (
          <TextField
            key={key}
            label={content.weightLabel(content.sectionNames[key])}
            type="number"
            value={Number.isNaN(rubric.weights[key]) ? '' : rubric.weights[key]}
            disabled={disabled}
            onChange={(event) => changeWeight(key, event.target.value)}
            slotProps={{ htmlInput: { min: 0, max: 100, step: 'any' } }}
          />
        ))}
      </Stack>
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
        <Typography>{content.total}</Typography>
        <Status label={content.totalLabel(total, invalidWeights)} />
      </Stack>
      <Accordion disableGutters>
        <AccordionSummary>{content.recommendationThresholds}</AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(3,1fr)' },
                gap: 2,
              }}
            >
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
            </Box>
            <Divider />
            <Typography variant="body2">{content.marginHint}</Typography>
          </Stack>
        </AccordionDetails>
      </Accordion>
    </Card>
  )
}
