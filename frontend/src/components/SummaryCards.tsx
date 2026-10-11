import { Box, Typography } from '@mui/material'
import { Card } from './common'

export interface SummaryItem {
  label: string
  value: string | number
  hint: string
}

export function SummaryCards({ items }: { items: SummaryItem[] }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' },
        gap: 3,
      }}
    >
      {items.map(({ label, value, hint }) => (
        <Card key={label} title={label}>
          <Typography
            variant="h3"
            component="p"
            sx={{ fontSize: { xs: 28, sm: 40 }, overflowWrap: 'anywhere' }}
          >
            {value}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {hint}
          </Typography>
        </Card>
      ))}
    </Box>
  )
}
