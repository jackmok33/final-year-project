import { useContent } from '../../hooks/useContent'
import { Box, FormControlLabel, Radio, RadioGroup, Typography } from '@mui/material'
import { type Outcome } from '../../domain/types'

export function OutcomeOptions({
  outcome,
  setOutcome,
  critical,
}: {
  outcome: Outcome
  setOutcome: (outcome: Outcome) => void
  critical: boolean
}) {
  const content = useContent('outcomeOptions')
  return (
    <RadioGroup
      aria-label={content.tutorOutcome}
      value={outcome}
      onChange={(e) => setOutcome(e.target.value as Outcome)}
    >
      {(['Further review', 'Offer', 'Reject'] as const).map((o) => (
        <Box
          key={o}
          sx={{
            bgcolor: outcome === o ? '#EEDEFF' : '#FAFAFA',
            borderRadius: 1,
            px: 2,
            py: 1,
            mb: 1,
          }}
        >
          <FormControlLabel
            value={o}
            control={<Radio color="secondary" />}
            label={content.outcomeLabels[o]}
            disabled={critical && o !== 'Further review'}
          />
          <Typography variant="body2" color="text.secondary" sx={{ ml: 4 }}>
            {o === 'Further review' ? content.reviewHint : content.finalDecisionHint}
          </Typography>
        </Box>
      ))}
    </RadioGroup>
  )
}
