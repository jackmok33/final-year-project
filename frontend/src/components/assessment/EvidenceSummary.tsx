import { Box, Stack, Typography } from '@mui/material'
import type { EvidenceGroup } from '../../services/applicantPresentation'
import { useContent } from '../../hooks/useContent'

export function EvidenceSummary({ groups }: { groups: EvidenceGroup[] }) {
  const content = useContent('evidenceSummary')
  return (
    <Box sx={{ mt: 4 }}>
      <Typography variant="subtitle1" component="h2" sx={{ mb: 2 }}>
        {content.evidence}
      </Typography>
      {!groups.length ? (
        <Typography color="text.secondary">{content.noEvidence}</Typography>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 4 }}>
          {[
            groups.filter((group) => !['projects', 'work'].includes(group.key)),
            groups.filter((group) => ['projects', 'work'].includes(group.key)),
          ].map((column, index) => (
            <Stack key={index} spacing={3}>
              {column.map((group) => (
                <Box key={group.key}>
                  <Typography variant="subtitle1" component="h3">
                    {content[group.key]}
                  </Typography>
                  <Stack spacing={2}>
                    {group.entries.map((entry, i) => (
                      <Box key={i}>
                        {entry.map((line, j) => (
                          <Typography key={j}>{line}</Typography>
                        ))}
                      </Box>
                    ))}
                  </Stack>
                </Box>
              ))}
            </Stack>
          ))}
        </Box>
      )}
    </Box>
  )
}
