// Adapted from full-version/src/components/cards/statistics/AnalyticEcommerce.tsx.
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import MainCard from './MainCard'

// Admissions metrics have no sales/trend text. The source card's compact
// title/count/supporting-text layout accepts the page's existing values.
interface Props {
  title: string
  count: string | number
  extra?: string
}

export default function AnalyticEcommerce({ title, count, extra }: Props) {
  return (
    <MainCard contentSX={{ p: 2.25 }}>
      <Stack sx={{ gap: 0.5 }}>
        <Typography variant="h6" component="h2" color="text.secondary">
          {title}
        </Typography>
        <Stack direction="row" sx={{ alignItems: 'center' }}>
          <Typography variant="h4" component="p" sx={{ overflowWrap: 'anywhere' }}>
            {count}
          </Typography>
        </Stack>
      </Stack>
      {extra && (
        <Box sx={{ pt: 2.25 }}>
          <Typography variant="caption" color="text.secondary">
            {extra}
          </Typography>
        </Box>
      )}
    </MainCard>
  )
}
