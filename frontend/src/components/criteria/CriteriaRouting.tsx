import { useContent } from '../../hooks/useContent'
import { Alert, Divider, Typography } from '@mui/material'
import { Card } from '../common'

export function CriteriaRouting() {
  const content = useContent('criteriaRouting')
  return (
    <Card title={content.howRecommendationsAreRouted}>
      <Typography sx={{ fontWeight: 600 }}>{content.evidenceStep}</Typography>
      <Typography>{content.evidenceDescription}</Typography>
      <Divider />
      <Typography sx={{ fontWeight: 600 }}>{content.failureStep}</Typography>
      <Typography>{content.failureDescription}</Typography>
      <Divider />
      <Typography sx={{ fontWeight: 600 }}>{content.scoreStep}</Typography>
      <Typography>{content.scoreDescription}</Typography>
      <Alert severity="info">{content.activationNotice}</Alert>
    </Card>
  )
}
