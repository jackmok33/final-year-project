import { Box, Stack, Typography } from '@mui/material'
import { Card } from './common'

export interface SummaryItem {
  label: string
  value: string | number
  hint?: string
}

export function SummaryCards({ items }: { items: SummaryItem[] }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: 'repeat(2, minmax(0, 1fr))',
          lg: `repeat(${Math.max(1, Math.min(items.length, 4))}, minmax(0, 1fr))`,
        },
        gap: { xs: 2, md: 3 },
      }}
    >
      {items.map(({ label, value, hint }) => (
        <Card key={label}>
          <Stack spacing={1}>
            <Typography component="h2" variant="body1" color="text.secondary">
              {label}
            </Typography>
            <Typography
              variant="h3"
              component="p"
              sx={{
                fontSize: { xs: 26, sm: 32 },
                fontWeight: 600,
                overflowWrap: 'anywhere',
                lineHeight: 1.2,
              }}
            >
              {value}
            </Typography>
            {hint && (
              <Typography variant="body2" color="text.secondary">
                {hint}
              </Typography>
            )}
          </Stack>
        </Card>
      ))}
    </Box>
  )
}
