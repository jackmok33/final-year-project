// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import '../../test/domSetup'
import { administrator, programme, tutor } from '../../test/fixtures'
import { renderPage } from '../../test/renderPage'
import { UserPermissions } from './UserPermissions'

describe('UserPermissions', () => {
  it('lists actual ownership and ignores legacy programme assignments', () => {
    const view = renderPage(<UserPermissions form={tutor} programmes={[programme]} />)
    expect(screen.getByText(programme.name)).toBeInTheDocument()
    view.rerender(
      <UserPermissions
        form={{ ...administrator, programmeIds: [programme.id] }}
        programmes={[programme]}
      />,
    )
    expect(screen.queryByText(programme.name)).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })
})
