// @vitest-environment jsdom
import { ThemeProvider } from '@mui/material'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { theme } from '../../app/theme'
import '../../test/domSetup'
import TabsCard from './TabsCard'
describe('TabsCard', () => {
  it('changes tabs by keyboard, skips disabled actions and exposes only the selected panel', async () => {
    function Example() {
      const [tab, setTab] = useState('summary')
      return (
        <TabsCard
          value={tab}
          onChange={setTab}
          label="Applicant review"
          tabs={[
            { value: 'summary', label: 'Summary', content: <p>Recommendation evidence</p> },
            { value: 'decision', label: 'Decision', disabled: true, content: <p>Save outcome</p> },
            { value: 'documents', label: 'Documents', content: <p>Original PDF</p> },
          ]}
        />
      )
    }
    render(
      <ThemeProvider theme={theme}>
        <Example />
      </ThemeProvider>,
    )
    screen.getByRole('tab', { name: 'Summary' }).focus()
    await userEvent.keyboard('{ArrowRight}{Enter}')
    expect(screen.getByRole('tab', { name: 'Documents' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Original PDF')
    expect(screen.queryByText('Recommendation evidence')).not.toBeInTheDocument()
    expect(screen.queryByText('Save outcome')).not.toBeInTheDocument()
  })
})
