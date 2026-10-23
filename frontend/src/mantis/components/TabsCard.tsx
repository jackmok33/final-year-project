// Adapted from Mantis 4.0.1 sections/components-overview/tabs/BasicTabs.tsx.
import { useId, type ReactNode } from 'react'
import { Box, Stack, Tab, Tabs } from '@mui/material'
import MainCard from './MainCard'

export interface WorkspaceTab {
  value: string
  label: string
  content: ReactNode
  disabled?: boolean
}

export default function TabsCard({
  value,
  onChange,
  tabs,
  label,
  action,
  minHeight = 0,
}: {
  value: string
  onChange: (value: string) => void
  tabs: WorkspaceTab[]
  label: string
  action?: ReactNode
  minHeight?: number
}) {
  const id = useId()
  return (
    <MainCard content={false}>
      <Box sx={{ px: 2.5 }}>
        <Stack
          direction="row"
          sx={{ alignItems: 'center', borderBottom: 1, borderColor: 'divider', gap: 2 }}
        >
          <Tabs
            value={value}
            onChange={(_, next: string) => onChange(next)}
            aria-label={label}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ flex: 1, minWidth: 0 }}
          >
            {tabs.map((tab) => (
              <Tab
                key={tab.value}
                value={tab.value}
                label={tab.label}
                disabled={tab.disabled}
                id={`${id}-${tab.value}`}
                aria-controls={`${id}-${tab.value}-panel`}
              />
            ))}
          </Tabs>
          {action}
        </Stack>
      </Box>
      {tabs.map((tab) => (
        <Box
          key={tab.value}
          role="tabpanel"
          hidden={value !== tab.value}
          id={`${id}-${tab.value}-panel`}
          aria-labelledby={`${id}-${tab.value}`}
          sx={{ minHeight }}
        >
          {value === tab.value && tab.content}
        </Box>
      ))}
    </MainCard>
  )
}
