import ReloadOutlined from '@ant-design/icons/ReloadOutlined'
import { Alert, Box, Button, Chip, Typography } from '@mui/material'
import { useBackendHealthQuery } from '../app/api'
import { ErrorNotice, Loading, Page } from '../components/common'
import { useContent } from '../hooks/useContent'
import MainCard from '../mantis/components/MainCard'

export function ServiceHealthPage() {
  const content = useContent('serviceHealthPage')
  const {
    currentData: report,
    isFetching,
    error,
    refetch,
  } = useBackendHealthQuery(undefined, {
    refetchOnMountOrArgChange: true,
  })
  const available = report?.state === 'available'
  const status = available
    ? content.available
    : report?.state === 'unavailable'
      ? content.unavailable
      : content.notConfigured

  return (
    <Page
      title={content.title}
      subtitle={content.subtitle}
      actions={
        <Button
          variant="outlined"
          startIcon={<ReloadOutlined aria-hidden="true" />}
          disabled={isFetching}
          onClick={() => void refetch()}
        >
          {isFetching ? content.checking : content.refresh}
        </Button>
      }
    >
      <ErrorNotice error={error} />
      {isFetching ? (
        <Loading />
      ) : report ? (
        <MainCard
          title={content.backend}
          secondary={
            <Chip
              label={status}
              variant="combined"
              color={available ? 'success' : report.state === 'unavailable' ? 'error' : 'default'}
            />
          }
        >
          {report.state === 'not-configured' && <Alert severity="info">{content.noBackend}</Alert>}
          {report.state === 'unavailable' && <Alert severity="error">{report.error}</Alert>}
          {report.state === 'available' && (
            <Box
              component="dl"
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '180px 1fr' },
                gap: 2,
                m: 0,
                '& dd': { m: 0 },
              }}
            >
              {[
                [content.service, report.health.service],
                [content.mode, content.mockMode],
                [content.database, content.notConfigured],
                [content.inference, content.notConfigured],
              ].map(([label, value]) => (
                <Box key={label} sx={{ display: 'contents' }}>
                  <Typography component="dt" color="text.secondary">
                    {label}
                  </Typography>
                  <Typography component="dd">{value}</Typography>
                </Box>
              ))}
            </Box>
          )}
          <Typography color="text.secondary" sx={{ mt: 3 }}>
            {content.checkedAt(report.checkedAt)}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            {content.scope}
          </Typography>
        </MainCard>
      ) : null}
    </Page>
  )
}
