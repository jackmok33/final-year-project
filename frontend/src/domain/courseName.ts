/** Course names are display text; preserve their case, spaces and punctuation. */
export function normalizeCourseName(value: string): string | undefined {
  const name = value.trim()
  return name.length > 0 && name.length <= 100 ? name : undefined
}
