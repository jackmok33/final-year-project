import { useContent } from '../hooks/useContent'
import { Alert, Button, MenuItem, Stack, TextField } from '@mui/material'
import { useState } from 'react'
import { useCommandMutation, useProgrammesQuery } from '../app/api'
import { ProgrammeForm } from '../components/admin/ProgrammeForm'
import { ErrorNotice, Loading } from '../components/common'
import type { Programme } from '../domain/types'

export function ProgrammeSettingsPage() {
  const content = useContent('programmeSettingsPage')
  const { data, isLoading, error } = useProgrammesQuery()
  const [notice, setNotice] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  if (isLoading) return <Loading />
  if (!data) return <ErrorNotice error={error} />
  const newProgramme = creating || !data.length
  const programme = newProgramme
    ? {
        id: '',
        name: '',
        code: '',
        year: '2026 / 27',
        department: '',
        description: '',
      }
    : (data.find((p) => p.id === selected) ?? data[0])
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
          value={newProgramme ? '' : programme.id}
          sx={{ minWidth: 240 }}
          onChange={(e) => {
            setSelected(e.target.value)
            setCreating(false)
            setNotice('')
          }}
        >
          {newProgramme && <MenuItem value="">{content.newProgramme}</MenuItem>}
          {data.map((p) => (
            <MenuItem key={p.id} value={p.id}>
              {p.name}
            </MenuItem>
          ))}
        </TextField>
        <Button
          variant="outlined"
          onClick={() => {
            setCreating(true)
            setNotice('')
          }}
        >
          {content.newProgramme}
        </Button>
      </Stack>
      <ProgrammeEditor
        key={newProgramme ? 'new' : JSON.stringify(programme)}
        programme={programme}
        onSaved={(id) => {
          setSelected(id)
          setCreating(false)
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
      const result = await command({ op: 'programme', programme: form }).unwrap()
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
