import PlusOutlined from '@ant-design/icons/PlusOutlined'
import { Alert, Button } from '@mui/material'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCommandMutation, useProgrammeIntakesQuery } from '../app/api'
import { useWorkspace } from '../hooks/useWorkspace'
import { ErrorNotice, Loading, Page } from '../components/common'
import { CreateWorkspaceDialog } from '../components/workspace/CreateWorkspaceDialog'
import { ModuleCards } from '../components/workspace/ModuleCards'
import { useContent } from '../hooks/useContent'
import { normalizeCourseName } from '../domain/courseName'
import { useIsMounted } from '../hooks/useIsMounted'

export function ModulesPage() {
  const content = useContent('modulesPage')
  const { programmes, isLoading, error } = useWorkspace()
  const { data: intakes } = useProgrammeIntakesQuery()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [saveError, setSaveError] = useState<unknown>()
  const [command, { isLoading: saving }] = useCommandMutation()
  const navigate = useNavigate()
  const isMounted = useIsMounted()
  const normalizedName = normalizeCourseName(name)
  async function createWorkspace() {
    if (saving || !normalizedName) return
    setSaveError(undefined)
    try {
      const { id } = await command({ op: 'workspace', name: normalizedName }).unwrap()
      if (isMounted() && id) {
        setOpen(false)
        navigate(`/batches?${new URLSearchParams({ programme: id })}`)
      }
    } catch (error) {
      if (isMounted()) setSaveError(error)
    }
  }
  if (isLoading) return <Loading />
  return (
    <Page
      title={content.title}
      actions={
        <Button
          variant="contained"
          startIcon={<PlusOutlined aria-hidden="true" />}
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
      <ModuleCards modules={programmes} intakes={intakes} />
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
