import ArrowRightOutlined from '@ant-design/icons/ArrowRightOutlined'
import { Box, CardActionArea, Stack, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import type { Programme } from '../../domain/types'
import { intakeYears } from '../../domain/intakes'
import { programmeIntakeLabel } from '../../domain/programmeDisplay'
import { useContent } from '../../hooks/useContent'
import MainCard from '../../mantis/components/MainCard'

export function ModuleCards({
  modules,
  intakes = [],
}: {
  modules: Programme[]
  intakes?: { programmeId: string; years: string[] }[]
}) {
  const content = useContent('moduleCards')
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr',
          sm: 'repeat(2,minmax(0,1fr))',
          lg: 'repeat(3,minmax(0,1fr))',
        },
        gap: { xs: 3, lg: 6 },
        maxWidth: 900,
        py: 1,
      }}
    >
      {modules.flatMap((module) =>
        (
          intakes.find((item) => item.programmeId === module.id)?.years ?? intakeYears(module, [])
        ).map((year) => {
          const label = programmeIntakeLabel(module, year)
          return (
            <MainCard key={`${module.id}:${year}`} content={false}>
              <CardActionArea
                component={Link}
                to={`/batches?${new URLSearchParams({ programme: module.id, intake: year })}`}
                aria-label={content.openProgramme(label)}
                sx={{ p: 3, minHeight: 126 }}
              >
                <Stack spacing={1.5}>
                  <Typography variant="h2" component="h2" sx={{ overflowWrap: 'anywhere' }}>
                    {label}
                  </Typography>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ color: 'primary.main', alignItems: 'center' }}
                  >
                    <Typography variant="body2">{content.uploadApplications}</Typography>
                    <ArrowRightOutlined aria-hidden="true" />
                  </Stack>
                </Stack>
              </CardActionArea>
            </MainCard>
          )
        }),
      )}
    </Box>
  )
}
