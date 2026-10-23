// Adapted from Mantis 4.0.1 components/third-party/react-table/TablePagination.tsx.
// The controlled contract avoids coupling the workspace to the template's table engine.
import { useId } from 'react'
import { MenuItem, Pagination, Select, Stack, TextField, Typography } from '@mui/material'

export default function TablePagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  labels,
}: {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  labels: {
    navigation: string
    rowsPerPage: string
    goTo: string
    pageSize: (size: number) => string
  }
}) {
  const id = useId()
  const count = Math.max(1, Math.ceil(total / pageSize))
  return (
    <Stack
      direction="row"
      sx={{ justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap', gap: 1.5, p: 2.5 }}
    >
      <Pagination
        aria-label={labels.navigation}
        count={count}
        page={page + 1}
        onChange={(_, next) => onPageChange(next - 1)}
        color="primary"
        variant="outlined"
        shape="rounded"
      />
      <Typography
        component="label"
        htmlFor={`${id}-size`}
        variant="body2"
        color="text.secondary"
        id={`${id}-size-label`}
      >
        {labels.rowsPerPage}
      </Typography>
      <Select
        id={`${id}-size`}
        labelId={`${id}-size-label`}
        size="small"
        value={pageSize}
        onChange={(event) => onPageSizeChange(Number(event.target.value))}
      >
        {[5, 10, 25, 50].map((size) => (
          <MenuItem key={size} value={size}>
            {labels.pageSize(size)}
          </MenuItem>
        ))}
      </Select>
      <Typography component="label" htmlFor={`${id}-goto`} variant="body2" color="text.secondary">
        {labels.goTo}
      </Typography>
      <TextField
        id={`${id}-goto`}
        type="number"
        size="small"
        value={page + 1}
        onChange={(event) => {
          const next = Number(event.target.value)
          if (Number.isInteger(next) && next >= 1 && next <= count) onPageChange(next - 1)
        }}
        slotProps={{ htmlInput: { min: 1, max: count, step: 1 } }}
        sx={{ width: 64 }}
      />
    </Stack>
  )
}
