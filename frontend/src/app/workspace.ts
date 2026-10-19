import { useMeQuery, useProgrammesQuery } from './api'
import { useAppSelector } from './store'
import { normalizeIntakeYear } from '../domain/intakes'

export function useWorkspace() {
  const { data: user } = useMeQuery()
  const { data, isLoading, error } = useProgrammesQuery()
  const preferred = useAppSelector((s) => user && s.ui.programmeByUser[user.id])
  const programmes =
    data?.filter((p) => user?.roles.includes('tutor') && p.createdBy === user.id) ?? []
  const programme = programmes.find((p) => p.id === preferred) ?? programmes[0]
  const selectedYear = useAppSelector(
    (s) => user && programme && s.ui.intakeByUser[user.id]?.[programme.id],
  )
  const intakeYear = selectedYear?.trim()
    ? (normalizeIntakeYear(selectedYear) ?? selectedYear)
    : programme?.year
  return { user, programmes, programme, intakeYear, isLoading, error }
}
