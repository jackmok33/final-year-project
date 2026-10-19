import { useContent } from '../../hooks/useContent'
import { Alert, Box, Button, Stack, TextField } from '@mui/material'
import type { Programme } from '../../domain/types'
import { Card, ErrorNotice, Page, TwoColumns } from '../common'
import { ProgrammeAccess } from './ProgrammeAccess'

export function ProgrammeForm({
  form,
  setForm,
  mutation,
  save,
  cancel,
}: {
  form: Programme
  setForm: (programme: Programme) => void
  mutation: { isLoading: boolean; error?: unknown }
  save: () => Promise<void>
  cancel: () => void
}) {
  const content = useContent('programmeForm')
  return (
    <Page title={content.programmeSettings} subtitle={content.subtitle}>
      <TwoColumns>
        <Card title={content.programmeMetadata}>
          <Box
            component="form"
            onSubmit={(e) => {
              e.preventDefault()
              void save()
            }}
          >
            <Stack spacing={2.5}>
              {(
                [
                  ['code', content.programmeCode],
                  ['year', content.academicYear],
                  ['department', content.department],
                  ['description', content.description],
                ] as const
              ).map(([key, label]) => (
                <TextField
                  key={key}
                  label={label}
                  required={['code', 'year'].includes(key)}
                  value={form[key]}
                  multiline={key === 'description'}
                  minRows={key === 'description' ? 3 : undefined}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              ))}
              <ErrorNotice error={mutation.error} />
              <Stack direction="row" spacing={1}>
                <Button variant="contained" type="submit" disabled={mutation.isLoading}>
                  {content.saveProgramme}
                </Button>
                <Button onClick={cancel}>{content.cancelChanges}</Button>
              </Stack>
              <Alert severity="info">{content.metadataNotice}</Alert>
            </Stack>
          </Box>
        </Card>
        <ProgrammeAccess />
      </TwoColumns>
    </Page>
  )
}
