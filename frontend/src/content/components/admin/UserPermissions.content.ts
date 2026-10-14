import type { ContentValue } from '../../formatText'

export const userPermissionsContent = {
  assignedCourseWorkspaces: 'Assigned course workspaces',
  programmeAccessLabel: (name: ContentValue) => `Programme access: ${String(name)}`,
} as const
