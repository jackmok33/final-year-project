import { useLocation } from 'react-router-dom'

export function Location() {
  const location = useLocation()
  return (
    <output aria-label="Current URL">
      {location.pathname}
      {location.search}
    </output>
  )
}
