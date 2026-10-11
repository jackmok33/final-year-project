import { useContent } from '../hooks/useContent'
import { Button } from '@mui/material'
import { useState } from 'react'
import { useCommandMutation, useProgrammesQuery, useUsersQuery } from '../app/api'
import { AccountsTable } from '../components/admin/AccountsTable'
import { UserForm } from '../components/admin/UserForm'
import { ErrorNotice, Loading, Page, TwoColumns } from '../components/common'
import type { Programme, User } from '../domain/types'

export function UsersAccessPage() {
  const content = useContent('usersAccessPage')
  const { data: users, isLoading, error } = useUsersQuery()
  const { data: programmes } = useProgrammesQuery()
  const [editing, setEditing] = useState<string | null>(null)
  if (isLoading) return <Loading />
  const blank: User = {
    id: '',
    name: '',
    email: '',
    roles: ['tutor'],
    programmeIds: [],
    canPublishCriteria: false,
    active: true,
  }
  const selected = users?.find((u) => u.id === editing) ?? blank
  return (
    <Page
      title={content.usersAccess}
      subtitle={content.subtitle}
      actions={
        <Button variant="contained" onClick={() => setEditing(null)}>
          {content.newAccount}
        </Button>
      }
    >
      <ErrorNotice error={error} />
      <TwoColumns>
        <AccountsTable users={users} programmes={programmes} setEditing={setEditing} />
        {programmes && (
          <AccountEditor
            key={editing ?? 'new'}
            user={selected}
            programmes={programmes}
            onDone={() => setEditing(null)}
          />
        )}
      </TwoColumns>
    </Page>
  )
}

// Keep the draft tied to the selected record/version without moving page logic into UI components.
function AccountEditor({
  user,
  programmes,
  onDone,
}: {
  user: User
  programmes: Programme[]
  onDone: () => void
}) {
  const content = useContent('usersAccessPage')
  const [form, setForm] = useState<User>(structuredClone(user))
  const [command, mutation] = useCommandMutation()
  const [message, setMessage] = useState('')
  const role = form.roles.length === 2 ? 'both' : form.roles[0]
  async function save() {
    try {
      await command({ op: 'user', user: form }).unwrap()
      setMessage(content.accountAndPermissionsSaved)
      if (form.id) onDone()
      else setForm({ ...user })
    } catch {
      setMessage('')
    }
  }
  function setRole(role: 'both' | 'tutor' | 'admin') {
    setForm({ ...form, roles: role === 'both' ? ['tutor', 'admin'] : [role] })
  }

  return (
    <UserForm
      form={form}
      programmes={programmes}
      setForm={setForm}
      mutation={mutation}
      message={message}
      role={role}
      setRole={setRole}
      save={save}
    />
  )
}
