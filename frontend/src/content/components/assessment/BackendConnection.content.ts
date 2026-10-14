export const backendConnectionContent = {
  checking: 'Checking FastAPI connection…',
  connected:
    'FastAPI connected · mock mode. Re-evaluate a seeded case to receive a backend assessment.',
  assessed:
    'This assessment came from FastAPI · mock scores and explanations. Database and AI are not connected.',
  unavailable:
    'FastAPI is unavailable. Check that the local backend is running, then retry. Saved browser records are still available.',
} as const
