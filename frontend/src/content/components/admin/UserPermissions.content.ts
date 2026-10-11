import type { ContentValue } from '../../formatText'

export const userPermissionsContent = {
  assignedCourseWorkspaces: 'Assigned course workspaces',
  programmeAccessLabel: (name: ContentValue) => `Programme access: ${String(name)}`,
  allowRubricPublication: 'Allow rubric publication',
} as const
