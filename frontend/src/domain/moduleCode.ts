/** Module codes are case-insensitive identifiers, separate from persisted record IDs. */
export function normalizeModuleCode(value: string): string | undefined {
  const code = value.trim().toUpperCase()
  return code.length <= 100 && /^[A-Z0-9][A-Z0-9_-]*$/.test(code) ? code : undefined
}
