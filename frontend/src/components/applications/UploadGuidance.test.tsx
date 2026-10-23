// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { uploadGuidanceContent } from '../../content/components/applications/UploadGuidance.content'
import '../../test/domSetup'
import { renderPage } from '../../test/renderPage'
import { UploadGuidance } from './UploadGuidance'

describe('UploadGuidance', () => {
  it('presents the document requirements under a heading', () => {
    renderPage(<UploadGuidance />)
    expect(
      screen.getByRole('heading', { name: uploadGuidanceContent.beforeYouSubmit }),
    ).toBeInTheDocument()
    expect(screen.getByText(uploadGuidanceContent.documentGuidance)).toBeInTheDocument()
  })
})
