import { useContent } from '../hooks/useContent'
import { Alert } from '@mui/material'
import { useState } from 'react'
import { errorMessage, useAuditQuery, useCommandMutation } from '../app/api'
import { BackupRecovery } from '../components/admin/BackupRecovery'
import type { DataOperation, PendingRestore } from '../components/admin/DataOperationConfirmation'
import { DataOperationConfirmation } from '../components/admin/DataOperationConfirmation'
import { MaintenanceActivity } from '../components/admin/MaintenanceActivity'
import { RetentionDeletion } from '../components/admin/RetentionDeletion'
import { ErrorNotice, Page, TwoColumns } from '../components/common'
import { downloadBlob } from '../components/files'
import type { Backup } from '../domain/types'
import { discardBackup, stageBackup, takeBackup, validateBackup } from '../services/demo'
export function DataOperationsPage() {
  const content = useContent('dataOperationsPage')
  const { data: events, error } = useAuditQuery()
  const [command, mutation] = useCommandMutation()
  const [id, setId] = useState('')
  const [action, setAction] = useState<DataOperation | null>(null)
  const [pending, setPending] = useState<PendingRestore | null>(null)
  const [notice, setNotice] = useState('')
  const [localError, setLocalError] = useState('')
  const [reading, setReading] = useState(false)
  async function backup() {
    setNotice('')
    setLocalError('')
    try {
      const result = await command({ op: 'backup' }).unwrap()
      const backup = result.backupId ? takeBackup(result.backupId) : undefined
      if (!backup) throw new Error(content.backupCouldNotBeExported)
      downloadBlob(
        new Blob([JSON.stringify(backup)], { type: 'application/json' }),
        content.backupFilename(new Date().toISOString().slice(0, 10)),
      )
      setNotice(content.backupSuccess)
    } catch (error) {
      setLocalError(errorMessage(error))
    }
  }
  async function selectBackup(file?: File) {
    if (!file) return
    setReading(true)
    setLocalError('')
    setNotice('')
    try {
      if (file.size > 100 * 1024 * 1024) throw new Error(content.backupSizeError)
      const backup: unknown = JSON.parse(await file.text())
      const checked = await validateBackup(backup)
      if (pending) discardBackup(pending.id)
      setPending({
        id: stageBackup(backup as Backup),
        applications: checked.dataset.applications.length,
        documents: checked.dataset.documents.length,
      })
      setAction('restore')
    } catch (error) {
      setLocalError(errorMessage(error))
    } finally {
      setReading(false)
    }
  }
  function cancel() {
    if (pending) discardBackup(pending.id)
    setPending(null)
    setAction(null)
  }
  async function confirm() {
    setNotice('')
    setLocalError('')
    try {
      if (action === 'delete') await command({ op: 'delete', id: id.trim() }).unwrap()
      else if (action === 'restore' && pending)
        await command({ op: 'restore', backupId: pending.id }).unwrap()
      else if (action === 'reset') await command({ op: 'reset' }).unwrap()
      setNotice(
        action === 'delete'
          ? content.deletionSuccess(id.trim())
          : action === 'restore'
            ? content.restoreSuccess
            : content.resetSuccess,
      )
      setId('')
      cancel()
    } catch (error) {
      setLocalError(errorMessage(error))
      cancel()
    }
  }

  return (
    <Page title={content.dataOperations} subtitle={content.subtitle}>
      <Alert severity="info">{content.demoNotice}</Alert>
      <ErrorNotice error={error || mutation.error || localError} />
      {notice && (
        <Alert severity="success" role="status">
          {notice}
        </Alert>
      )}
      <TwoColumns equal>
        <BackupRecovery
          busy={mutation.isLoading}
          reading={reading}
          backup={backup}
          selectBackup={selectBackup}
        />
        <RetentionDeletion id={id} setId={setId} setAction={setAction} busy={mutation.isLoading} />
      </TwoColumns>
      <MaintenanceActivity events={events} />
      <DataOperationConfirmation
        action={action}
        cancel={cancel}
        confirm={confirm}
        busy={mutation.isLoading}
        id={id}
        pending={pending}
      />
    </Page>
  )
}
