// Mantis 4.0.1 custom-links branch, with React Router/MUI 9 and semantic heading compatibility.
import MuiBreadcrumbs from '@mui/material/Breadcrumbs'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import { Link as RouterLink } from 'react-router-dom'
import MainCard from './MainCard'

export interface BreadcrumbLink {
  title: string
  to: string
}

export interface BreadcrumbsProps {
  links: BreadcrumbLink[]
  label: string
}

export default function Breadcrumbs({ links, label }: BreadcrumbsProps) {
  return (
    <MainCard
      border={false}
      content={false}
      shadow="none"
      sx={{ mb: 3, bgcolor: 'inherit', backgroundImage: 'none' }}
    >
      <Grid
        container
        spacing={1}
        sx={{ flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start' }}
      >
        <Grid>
          <MuiBreadcrumbs aria-label={label} maxItems={8} separator="/">
            {links.map((link, index) => {
              const current = index === links.length - 1
              const item = (
                <Typography
                  key={index}
                  component={RouterLink}
                  to={link.to}
                  variant="h6"
                  color="textSecondary"
                  aria-current={current ? 'page' : undefined}
                  sx={{ textDecoration: 'none' }}
                >
                  {link.title}
                </Typography>
              )
              return current ? (
                <Typography key={index} component="h1" variant="h6">
                  {item}
                </Typography>
              ) : (
                item
              )
            })}
          </MuiBreadcrumbs>
        </Grid>
      </Grid>
    </MainCard>
  )
}
