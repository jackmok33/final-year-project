import { useContent } from '../../hooks/useContent'
import { Typography } from '@mui/material'
import { Card } from '../common'

export function UploadGuidance() {
  const content = useContent('uploadGuidance')
  return (
    <Card title={content.beforeYouSubmit}>
      <Typography>{content.documentGuidance}</Typography>
      <Typography variant="body2" color="text.secondary">
        {content.storageNotice}
      </Typography>
    </Card>
  )
}
