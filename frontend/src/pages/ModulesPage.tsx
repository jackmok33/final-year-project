import { AddOutlined } from '@mui/icons-material'
import { Alert, Button } from '@mui/material'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCommandMutation } from '../app/api'
import { useWorkspace } from '../app/workspace'
import { ErrorNotice, Loading, Page } from '../components/common'
import { CreateWorkspaceDialog } from '../components/workspace/CreateWorkspaceDialog'
import { ModuleCards } from '../components/workspace/ModuleCards'
import { useContent } from '../hooks/useContent'
import { normalizeCourseName } from '../domain/courseName'

export function ModulesPage() {
  const content = useContent('modulesPage')
  const { programmes, isLoading, error } = useWorkspace()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [saveError, setSaveError] = useState<unknown>()
  const [command, { isLoading: saving }] = useCommandMutation()
  const navigate = useNavigate()
  const normalizedName = normalizeCourseName(name)
  async function createWorkspace() {
    if (saving || !normalizedName) return
    setSaveError(undefined)
    try {
      const { id } = await command({ op: 'workspace', name: normalizedName }).unwrap()
      if (id) {
        setOpen(false)
        navigate(`/modules/${encodeURIComponent(id)}`)
      }
    } catch (error) {
      setSaveError(error)
    }
  }
  if (isLoading) return <Loading />
  return (
    <Page
      title={content.title}
      subtitle={content.subtitle}
      actions={
        <Button
          variant="contained"
          startIcon={<AddOutlined />}
          onClick={() => {
            setName('')
            setSaveError(undefined)
            setOpen(true)
          }}
        >
          {content.addCourse}
        </Button>
      }
    >
      <ErrorNotice error={error} />
      {!error && !programmes.length && <Alert severity="info">{content.empty}</Alert>}
      <ModuleCards modules={programmes} />
      <CreateWorkspaceDialog
        open={open}
        name={name}
        valid={!!normalizedName}
        saving={saving}
        error={saveError}
        onNameChange={(value) => {
          setName(value)
          setSaveError(undefined)
        }}
        onClose={() => setOpen(false)}
        onSubmit={() => void createWorkspace()}
      />
    </Page>
  )
}
