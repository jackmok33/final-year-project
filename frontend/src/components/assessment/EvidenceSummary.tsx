import { Box, Stack, Typography } from '@mui/material'
import type { EvidenceGroup } from '../../services/applicantPresentation'
import { useContent } from '../../hooks/useContent'
import MainCard from '../../mantis/components/MainCard'

export function EvidenceSummary({ groups }: { groups: EvidenceGroup[] }) {
  const content = useContent('evidenceSummary')
  return (
    <MainCard title={content.evidence} darkTitle contentSX={{ p: { xs: 2.5, md: 3 } }}>
      {!groups.length ? (
        <Typography color="text.secondary">{content.noEvidence}</Typography>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' },
            gap: 2.5,
          }}
        >
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
