import { Box } from '@mui/material'
import AnalyticEcommerce from '../mantis/components/AnalyticEcommerce'

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
        maxWidth: items.length === 3 ? 840 : undefined,
        gridTemplateColumns: {
          xs: 'repeat(2, minmax(0, 1fr))',
          lg: `repeat(${Math.max(1, Math.min(items.length, 4))}, minmax(0, 1fr))`,
        },
        gap: { xs: 2, md: 3 },
      }}
    >
      {items.map(({ label, value, hint }) => (
        <AnalyticEcommerce key={label} title={label} count={value} extra={hint} />
      ))}
    </Box>
  )
}
