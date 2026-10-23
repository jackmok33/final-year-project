// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { programmeAccessContent } from '../../content/components/admin/ProgrammeAccess.content'
import '../../test/domSetup'
import { renderPage } from '../../test/renderPage'
import { ProgrammeAccess } from './ProgrammeAccess'

describe('ProgrammeAccess', () => {
  it('explains access without offering assignment or course-creation controls', () => {
    renderPage(<ProgrammeAccess />)
    expect(
      screen.getByRole('heading', { name: programmeAccessContent.programmeAccess }),
    ).toBeInTheDocument()
    expect(screen.getByText(programmeAccessContent.accessDescription)).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
