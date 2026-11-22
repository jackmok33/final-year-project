import { Box, Stack, Typography } from '@mui/material'
import { englishBandKeys, type EnglishTestResult } from '../../domain/types'
import { useContent } from '../../hooks/useContent'

export function EnglishTestFacts({ result }: { result: EnglishTestResult }) {
  const content = useContent('englishTestFacts')
  return (
    <Stack spacing={1.5}>
      {result.testType && (
        <>
          <Typography>{content.reportDetails(result.testType, result.testDate)}</Typography>
          <Box component="dl" sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, m: 0 }}>
            {englishBandKeys.map((key) => (
              <div key={key}>
                <Typography component="dt" color="text.secondary">
                  {content.labels[key]}
                </Typography>
                <Typography component="dd" sx={{ m: 0, fontWeight: 600 }}>
                  {result[key]?.toFixed(1) ?? content.unavailableValue}
                </Typography>
              </div>
            ))}
          </Box>
        </>
      )}
      <Box role="status">
        <Typography variant="caption" color="text.secondary" component="div">
          {content.demoEligibility}
        </Typography>
        <Typography sx={{ fontWeight: 600 }}>{content.outcomes[result.outcome]}</Typography>
        {result.reason && <Typography>{content.reasons[result.reason]}</Typography>}
      </Box>
    </Stack>
  )
}
