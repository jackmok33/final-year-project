import { useContent } from '../../hooks/useContent'
import { FormControlLabel, Radio, RadioGroup, Typography } from '@mui/material'
import { tutorOutcomes, type TutorOutcome } from '../../domain/types'
import MainCard from '../../mantis/components/MainCard'

export function OutcomeOptions({
  outcome,
  setOutcome,
  critical,
}: {
  outcome: TutorOutcome
  setOutcome: (outcome: TutorOutcome) => void
  critical: boolean
}) {
  const content = useContent('outcomeOptions')
  return (
    <RadioGroup
      aria-label={content.tutorOutcome}
      value={outcome}
      onChange={(e) => setOutcome(e.target.value as TutorOutcome)}
    >
      {tutorOutcomes.map((o) => (
        <MainCard
          content={false}
          key={o}
          sx={{
            bgcolor: outcome === o ? 'primary.lighter' : 'background.paper',
            borderColor: outcome === o ? 'primary.main' : 'divider',
            px: 2,
            py: 1,
            mb: 1,
          }}
        >
          <FormControlLabel
            value={o}
            control={<Radio />}
            label={content.outcomeLabels[o]}
            disabled={critical}
          />
          <Typography variant="body2" color="text.secondary" sx={{ ml: 4 }}>
            {content.hints[o]}
          </Typography>
        </MainCard>
      ))}
    </RadioGroup>
  )
}
