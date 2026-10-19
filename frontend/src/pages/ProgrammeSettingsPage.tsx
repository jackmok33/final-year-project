import { useContent } from '../hooks/useContent'
import { Alert, MenuItem, Stack, TextField } from '@mui/material'
import { useState } from 'react'
import { useCommandMutation, useProgrammesQuery } from '../app/api'
import { ProgrammeForm } from '../components/admin/ProgrammeForm'
import { ErrorNotice, Loading, Page } from '../components/common'
import type { Programme } from '../domain/types'
import { normalizeModuleCode } from '../domain/moduleCode'

export function ProgrammeSettingsPage() {
  const content = useContent('programmeSettingsPage')
  const { data, isLoading, error } = useProgrammesQuery()
  const [notice, setNotice] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  if (isLoading) return <Loading />
  if (!data) return <ErrorNotice error={error} />
  if (!data.length)
    return (
      <Page title={content.title} subtitle={content.subtitle}>
        <Alert severity="info">{content.empty}</Alert>
      </Page>
    )
  const programme = data.find((p) => p.id === selected) ?? data[0]
  return (
    <Stack spacing={2}>
      {notice && (
        <Alert severity="success" role="status">
          {notice}
        </Alert>
      )}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          select
          label={content.manageProgramme}
          value={programme.id}
          sx={{ minWidth: 240 }}
          onChange={(e) => {
            setSelected(e.target.value)
            setNotice('')
          }}
        >
          {data.map((p) => (
            <MenuItem key={p.id} value={p.id}>
              {p.name}
            </MenuItem>
          ))}
        </TextField>
      </Stack>
      <ProgrammeEditor
        key={JSON.stringify(programme)}
        programme={programme}
        onSaved={(id) => {
          setSelected(id)
          setNotice(content.programmeSaved)
        }}
      />
    </Stack>
  )
}

// Keep the draft tied to the selected record/version without moving page logic into UI components.
function ProgrammeEditor({
  programme,
  onSaved,
}: {
  programme: Programme
  onSaved: (id: string) => void
}) {
  const [form, setForm] = useState(programme)
  const [command, mutation] = useCommandMutation()
  async function save() {
    try {
      const code = normalizeModuleCode(form.code) ?? form.code.trim()
      const result = await command({
        op: 'programme',
        programme: {
          ...form,
          name: form.name === programme.code ? code : form.name,
          code,
        },
      }).unwrap()
      onSaved(result.id!)
    } catch {
      /* Mutation error remains visible. */
    }
  }
  function cancel() {
    setForm(programme)
  }

  return (
    <ProgrammeForm form={form} setForm={setForm} mutation={mutation} save={save} cancel={cancel} />
  )
}
