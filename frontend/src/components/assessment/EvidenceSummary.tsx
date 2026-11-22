import { Box, Stack, Typography } from '@mui/material'
import type { EnglishTestResult } from '../../domain/types'
import type { EvidenceGroup } from '../../services/applicantPresentation'
import { useContent } from '../../hooks/useContent'
import MainCard from '../../mantis/components/MainCard'
import { EnglishTestFacts } from './EnglishTestFacts'

export function EvidenceSummary({
  groups,
  englishResult,
}: {
  groups: EvidenceGroup[]
  englishResult?: EnglishTestResult
}) {
  const content = useContent('evidenceSummary')
  return (
    <MainCard title={content.evidence} darkTitle contentSX={{ p: { xs: 2.5, md: 3 } }}>
      {!englishResult && !groups.length ? (
        <Typography color="text.secondary">{content.noEvidence}</Typography>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' },
            gap: 2.5,
          }}
        >
          {englishResult && (
            <MainCard contentSX={{ p: 2.5 }} sx={{ minWidth: 0 }}>
              <Typography variant="h5" component="h3" sx={{ mb: 2 }}>
                {content.english}
              </Typography>
              <EnglishTestFacts result={englishResult} />
            </MainCard>
          )}
          {groups.map((group) => (
            <MainCard key={group.key} contentSX={{ p: 2.5 }} sx={{ minWidth: 0 }}>
              <Typography variant="h5" component="h3" sx={{ mb: 2 }}>
                {content[group.key]}
              </Typography>
              <Stack spacing={2}>
                {group.entries.map((entry, i) => (
                  <Box key={i}>
                    {entry.map((line, j) => (
                      <Typography key={j} sx={{ lineHeight: 1.8, overflowWrap: 'anywhere' }}>
                        {line}
                      </Typography>
                    ))}
                  </Box>
                ))}
              </Stack>
            </MainCard>
          ))}
        </Box>
      )}
    </MainCard>
  )
}
