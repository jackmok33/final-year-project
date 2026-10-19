import { useContent } from '../../hooks/useContent'
import { SearchOutlined } from '@mui/icons-material'
import { InputAdornment, MenuItem, Stack, TextField } from '@mui/material'

export function ApplicationFilters({
  search,
  status,
  recommendation,
  setSearch,
  setStatus,
  setRecommendation,
}: {
  search: string
  status: string
  recommendation: string
  setSearch: (value: string) => void
  setStatus: (value: string) => void
  setRecommendation: (value: string) => void
}) {
  const content = useContent('applicationFilters')
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 2 }}>
      <TextField
        label={content.searchApplicationOrCandidate}
        value={search}
        sx={{ flex: 1.5 }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchOutlined fontSize="small" />
              </InputAdornment>
            ),
          },
        }}
        onChange={(e) => setSearch(e.target.value)}
      />
      <TextField
        label={content.workflowState}
        sx={{ flex: 1 }}
        select
        value={status}
        onChange={(e) => setStatus(e.target.value)}
      >
        <MenuItem value="all">{content.allStates}</MenuItem>
        {['not evaluated', 'queued', 'running', 'awaiting review', 'completed', 'failed'].map(
          (s) => (
            <MenuItem key={s} value={s}>
              {content.workflowLabels[s as keyof typeof content.workflowLabels]}
            </MenuItem>
          ),
        )}
      </TextField>
      <TextField
        label={content.recommendation}
        sx={{ flex: 1 }}
        select
        value={recommendation}
        onChange={(e) => setRecommendation(e.target.value)}
      >
        <MenuItem value="all">{content.allRecommendations}</MenuItem>
        {['Offer', 'Reject', 'Further review'].map((s) => (
          <MenuItem key={s} value={s}>
            {content.outcomeLabels[s as keyof typeof content.outcomeLabels]}
          </MenuItem>
        ))}
      </TextField>
    </Stack>
  )
}
