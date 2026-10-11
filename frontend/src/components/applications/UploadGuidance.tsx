import { useContent } from '../../hooks/useContent'
import { Alert, Typography } from '@mui/material'
import { Card } from '../common'

export function UploadGuidance() {
  const content = useContent('uploadGuidance')
  return (
    <Card title={content.beforeYouSubmit}>
      <Alert severity="info">{content.backendNotice}</Alert>
      <Typography>{content.documentGuidance}</Typography>
      <Typography variant="body2" color="text.secondary">
        {content.storageNotice}
      </Typography>
    </Card>
  )
}
