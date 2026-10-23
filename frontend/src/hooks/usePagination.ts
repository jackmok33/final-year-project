import { useState } from 'react'

/** Shared table navigation; filtering and sorting stay with each page. */
export function usePagination(total: number, initialPageSize = 10) {
  const [requestedPage, setPage] = useState(0)
  const [pageSize, setSize] = useState(initialPageSize)
  const lastPage = Math.max(0, Math.ceil(total / pageSize) - 1)
  const page = Math.min(requestedPage, lastPage)

  function resetPage() {
    setPage(0)
  }

  function setPageSize(size: number) {
    setSize(size)
    resetPage()
  }

  return {
    page,
    pageSize,
    startIndex: page * pageSize,
    endIndex: (page + 1) * pageSize,
    setPage,
    setPageSize,
    resetPage,
  }
}
