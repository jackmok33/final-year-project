import { ArrowForwardOutlined, FolderOutlined } from '@mui/icons-material'
import { Box, CardActionArea, Paper, Stack, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import type { Programme } from '../../domain/types'
import { useContent } from '../../hooks/useContent'

export function ModuleCards({ modules }: { modules: Programme[] }) {
  const content = useContent('moduleCards')
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr',
          sm: 'repeat(2, minmax(0, 1fr))',
          xl: 'repeat(3, minmax(0, 1fr))',
        },
        gap: 3,
      }}
    >
      {modules.map((module) => (
        <Paper key={module.id} variant="outlined" sx={{ overflow: 'hidden' }}>
          <CardActionArea
            component={Link}
            to={`/modules/${encodeURIComponent(module.id)}`}
            aria-label={content.openModule(module.name)}
            sx={{ p: 3, height: '100%' }}
          >
            <Stack spacing={2}>
              <FolderOutlined sx={{ color: 'primary.main', fontSize: 30 }} />
              <Box>
                <Typography variant="h4" component="h2" sx={{ overflowWrap: 'anywhere' }}>
                  {module.name}
                </Typography>
              </Box>
              <Stack
                direction="row"
                spacing={1}
                sx={{ alignItems: 'center', color: 'primary.main' }}
              >
                <Typography variant="body2">{content.selectIntake}</Typography>
                <ArrowForwardOutlined fontSize="small" />
              </Stack>
            </Stack>
          </CardActionArea>
        </Paper>
      ))}
    </Box>
  )
}
