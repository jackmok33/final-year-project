import { textValue, type ContentValue } from '../../formatText'

export const documentNavigationContent = {
  originalDocument: 'Original document',
  page: 'Page',
  pageOption: (page: ContentValue, pages: ContentValue) =>
    `${textValue(page)} of ${textValue(pages)}`,
} as const
