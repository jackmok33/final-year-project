import { ArrowForwardOutlined, CalendarMonthOutlined } from '@mui/icons-material'
import { Box, CardActionArea, Paper, Stack, Typography } from '@mui/material'
import { useContent } from '../../hooks/useContent'

export function IntakeCards({
  intakes,
  onSelect,
}: {
  intakes: { year: string; count?: number }[]
  onSelect: (year: string) => void
}) {
  const content = useContent('intakeCards')
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr',
          sm: 'repeat(2, minmax(0, 1fr))',
          lg: 'repeat(3, minmax(0, 1fr))',
        },
        gap: 3,
      }}
    >
      {intakes.map(({ year, count }) => (
        <Paper key={year} variant="outlined">
          <CardActionArea
            onClick={() => onSelect(year)}
            aria-label={content.openIntake(year)}
            sx={{ p: 3 }}
          >
            <Stack spacing={2}>
              <CalendarMonthOutlined sx={{ color: 'primary.main', fontSize: 30 }} />
              <Typography variant="h3" component="h2">
                {content.yearLabel(year)}
              </Typography>
              <Typography color="text.secondary">{content.applications(count)}</Typography>
              <Stack
                direction="row"
                spacing={1}
                sx={{ alignItems: 'center', color: 'primary.main' }}
              >
                <Typography variant="body2">{content.viewApplications}</Typography>
                <ArrowForwardOutlined fontSize="small" />
              </Stack>
            </Stack>
          </CardActionArea>
        </Paper>
      ))}
    </Box>
  )
}
