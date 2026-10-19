import { ArrowBackOutlined, DeleteOutlined } from '@mui/icons-material'
import { Alert, Button } from '@mui/material'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useApplicationsQuery, useCommandMutation, useWorkspaceDeletionQuery } from '../app/api'
import { selectProgramme, useAppDispatch } from '../app/store'
import { useWorkspace } from '../app/workspace'
import { ErrorNotice, Loading, Page } from '../components/common'
import { DeleteWorkspaceDialog } from '../components/workspace/DeleteWorkspaceDialog'
import { IntakeCards } from '../components/workspace/IntakeCards'
import { applicationIntakeYear, intakeYears } from '../domain/intakes'
import { useContent } from '../hooks/useContent'

export function ModuleIntakesPage() {
  const { id = '' } = useParams()
  return <ModuleIntakeController key={id} id={id} />
}

function ModuleIntakeController({ id }: { id: string }) {
  const content = useContent('moduleIntakesPage')
  const { user, programmes, isLoading, error } = useWorkspace()
  const module = programmes.find((p) => p.id === id)
  const applications = useApplicationsQuery(id, { skip: !module })
  const [confirming, setConfirming] = useState(false)
  const [deleteError, setDeleteError] = useState<unknown>()
  const [command, { isLoading: deleting }] = useCommandMutation()
  const impact = useWorkspaceDeletionQuery(id, { skip: !confirming })
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  function selectIntake(intakeYear: string) {
    if (!user || !module) return
    dispatch(selectProgramme({ userId: user.id, programmeId: module.id, intakeYear }))
    navigate('/batches')
  }
  async function deleteWorkspace() {
    if (!module || !user || deleting || impact.isFetching || !impact.currentData || impact.error)
      return
    setDeleteError(undefined)
    try {
      await command({ op: 'deleteWorkspace', id: module.id, confirmed: true }).unwrap()
      dispatch(
        selectProgramme({
          userId: user.id,
          programmeId: programmes.find((p) => p.id !== module.id)?.id ?? '',
        }),
      )
      setConfirming(false)
      navigate('/modules', { replace: true })
    } catch (error) {
      setDeleteError(error)
    }
  }
  const back = (
    <Button component={Link} to="/modules" startIcon={<ArrowBackOutlined />}>
      {content.back}
    </Button>
  )
  if (isLoading) return <Loading />
  if (!module)
    return (
      <Page title={content.unavailable} subtitle={content.unavailableHint} actions={back}>
        <ErrorNotice error={error} />
        <Alert severity="info">{content.unavailableHint}</Alert>
      </Page>
    )
  return (
    <Page
      title={module.name}
      subtitle={content.subtitle}
      actions={
        <>
          {module.createdBy === user?.id && (
            <Button
              color="error"
              variant="outlined"
              startIcon={<DeleteOutlined />}
              onClick={() => {
                setDeleteError(undefined)
                setConfirming(true)
              }}
            >
              {content.deleteCourse}
            </Button>
          )}
          {back}
        </>
      }
    >
      <ErrorNotice error={error ?? applications.error} />
      {applications.isLoading ? (
        <Loading />
      ) : (
        <IntakeCards
          intakes={intakeYears(module, applications.currentData ?? []).map((year) => ({
            year,
            count: applications.currentData?.filter(
              (a) => applicationIntakeYear(a, module) === year,
            ).length,
          }))}
          onSelect={selectIntake}
        />
      )}
      <DeleteWorkspaceDialog
        programme={confirming ? module : undefined}
        impact={impact.error ? undefined : impact.currentData}
        loading={impact.isFetching}
        busy={deleting}
        error={impact.error ?? deleteError}
        onClose={() => setConfirming(false)}
        onConfirm={() => void deleteWorkspace()}
      />
    </Page>
  )
}
