function nonBlank(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** Read useful messages from local exceptions, RTK Query and HTTP response bodies. */
export function errorMessage(error: unknown, fallback = 'The operation could not be completed.') {
  if (nonBlank(error)) return error
  if (!isRecord(error)) return fallback
  if (nonBlank(error.data)) return error.data
  if (isRecord(error.data)) {
    if (nonBlank(error.data.detail)) return error.data.detail
    if (nonBlank(error.data.message)) return error.data.message
  }
  if (nonBlank(error.detail)) return error.detail
  if (nonBlank(error.message)) return error.message
  return fallback
}
