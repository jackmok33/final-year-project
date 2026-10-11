export type ContentValue = string | number | boolean | null | undefined

// Match React text rendering: missing values and booleans render no text.
export function textValue(value: ContentValue): string {
  return value == null || typeof value === 'boolean' ? '' : String(value)
}
