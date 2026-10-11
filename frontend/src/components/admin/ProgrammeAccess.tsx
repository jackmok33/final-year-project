import { useContent } from '../../hooks/useContent'
import { Button, Divider, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import { Card, Status } from '../common'

export function ProgrammeAccess() {
  const content = useContent('programmeAccess')
  return (
    <Card title={content.programmeAccess}>
      <Status label={content.configuredProgramme} />
      <Typography>{content.accessDescription}</Typography>
      <Button component={Link} to="/admin/users">
        {content.manageTutorAccess}
      </Button>
      <Divider />
      <Typography sx={{ fontWeight: 600 }}>{content.admissionPolicy}</Typography>
      <Typography>{content.policyDescription}</Typography>
      <Typography variant="body2">{content.courseDescription}</Typography>
    </Card>
  )
}
