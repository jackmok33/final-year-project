import SearchOutlined from '@ant-design/icons/SearchOutlined'
import PlusOutlined from '@ant-design/icons/PlusOutlined'
import { Box, Button, InputAdornment, MenuItem, Stack, TextField } from '@mui/material'
import { Link } from 'react-router-dom'
import { useContent } from '../../hooks/useContent'
import type { ApplicantSort } from './ApplicationTable'

export function ApplicationFilters({
  search,
  status,
  sort,
  setSearch,
  setStatus,
  setSort,
  addPath,
}: {
  search: string
  status: string
  sort: ApplicantSort
  setSearch: (value: string) => void
  setStatus: (value: string) => void
  setSort: (value: ApplicantSort) => void
  addPath: string
}) {
  const content = useContent('applicationFilters')
  const sortOptions = [
    { value: 'newest', label: content.newest, column: 'submittedAt', direction: 'desc' },
    { value: 'highest', label: content.highest, column: 'score', direction: 'desc' },
    { value: 'lowest', label: content.lowest, column: 'score', direction: 'asc' },
    { value: 'name', label: content.nameSort, column: 'name', direction: 'asc' },
  ] as const
  const selectedSort = sortOptions.find(
    (option) => option.column === sort.column && option.direction === sort.direction,
  )
  return (
    <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 2, alignItems: 'center' }}>
      <TextField
        placeholder={content.search}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        sx={{ maxWidth: { md: 260 } }}
        slotProps={{
          htmlInput: { 'aria-label': content.search },
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchOutlined aria-hidden="true" />
              </InputAdornment>
            ),
          },
        }}
      />
      <Box sx={{ flex: 1 }} />
      <TextField
        select
        value={status}
        onChange={(event) => setStatus(event.target.value)}
        sx={{ width: { xs: '100%', md: 160 } }}
        slotProps={{ select: { 'aria-label': content.allStatus } }}
      >
        <MenuItem value="all">{content.allStatus}</MenuItem>
        {Object.entries(content.workflowLabels).map(([value, label]) => (
          <MenuItem key={value} value={value}>
            {label}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        select
        value={selectedSort?.value ?? 'column'}
        onChange={(event) => {
          const selected = sortOptions.find((option) => option.value === event.target.value)
          if (selected) setSort({ column: selected.column, direction: selected.direction })
        }}
        sx={{ width: { xs: '100%', md: 190 } }}
        slotProps={{ select: { 'aria-label': content.sort } }}
      >
        {!selectedSort && (
          <MenuItem value="column">
            {content.columnSort(content.sortColumns[sort.column], sort.direction)}
          </MenuItem>
        )}
        {sortOptions.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </TextField>
      <Button
        variant="contained"
        component={Link}
        to={addPath}
        startIcon={<PlusOutlined aria-hidden="true" />}
        sx={{ whiteSpace: 'nowrap' }}
      >
        {content.addApplicant}
      </Button>
    </Stack>
  )
}
