import { Alert, Button } from '@mui/material'
import { useState } from 'react'
import { useCommandMutation, useUsersQuery } from '../app/api'
import { AccountsTable } from '../components/admin/AccountsTable'
import { UserForm } from '../components/admin/UserForm'
import { ErrorNotice, Loading, Page } from '../components/common'
import type { User } from '../domain/types'
import { useContent } from '../hooks/useContent'
import { useIsMounted } from '../hooks/useIsMounted'
import CustomizedDialog from '../mantis/components/CustomizedDialog'

export function UsersAccessPage() {
  const content = useContent('usersAccessPage')
  const { currentData: users, isLoading, error } = useUsersQuery()
  const [editing, setEditing] = useState<User | null>(null)
  const [notice, setNotice] = useState('')
  if (isLoading) return <Loading />
  function open(user: User) {
    setEditing(user)
    setNotice('')
  }
  return (
    <Page
      title={content.usersAccess}
      breadcrumbs={[
        { title: content.administration, to: '/admin' },
        { title: content.usersAccess, to: '/admin/users' },
      ]}
      subtitle={content.subtitle}
      actions={
        <Button variant="contained" onClick={() => open(emptyAccount())} disabled={!users}>
          {content.newAccount}
        </Button>
      }
    >
      <ErrorNotice error={error} />
      {notice && (
        <Alert severity="success" role="status">
          {notice}
        </Alert>
      )}
      {users && <AccountsTable users={users} onEdit={open} />}
      {editing && (
        <AccountEditor
          key={editing.id || 'new'}
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            setNotice(content.accountSaved)
          }}
        />
      )}
    </Page>
  )
}

function emptyAccount(): User {
  return {
    id: '',
    name: '',
    email: '',
    roles: ['tutor'],
    programmeIds: [],
    canPublishCriteria: false,
    active: true,
  }
}

// Closing or selecting another account unmounts this keyed draft.
function AccountEditor({
  user,
  onClose,
  onSaved,
}: {
  user: User
  onClose: () => void
  onSaved: () => void
}) {
  const content = useContent('usersAccessPage')
  const [form, setForm] = useState<User>(structuredClone(user))
  const [command, mutation] = useCommandMutation()
  const isMounted = useIsMounted()
  const role = form.roles.length === 2 ? 'both' : form.roles[0]
  async function save() {
    if (mutation.isLoading) return
    try {
      await command({
        op: 'user',
        user: { ...form, name: form.name.trim(), email: form.email.trim().toLowerCase() },
      }).unwrap()
      if (isMounted()) onSaved()
    } catch {
      /* The mutation error remains visible beside the unchanged draft. */
    }
  }
  function setRole(role: 'both' | 'tutor' | 'admin') {
    setForm({ ...form, roles: role === 'both' ? ['tutor', 'admin'] : [role] })
  }

  return (
    <CustomizedDialog
      open
      title={user.id ? content.editAccount : content.createAccount}
      closeLabel={content.closeAccount}
      onClose={onClose}
      busy={mutation.isLoading}
    >
      <UserForm
        form={form}
        setForm={setForm}
        saving={mutation.isLoading}
        error={mutation.error}
        role={role}
        setRole={setRole}
        save={save}
        cancel={onClose}
      />
    </CustomizedDialog>
  )
}
