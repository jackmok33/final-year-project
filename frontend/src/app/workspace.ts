import { useMeQuery, useProgrammesQuery } from './api'
import { useAppSelector } from './store'

export function useWorkspace() {
  const { data: user } = useMeQuery()
  const { data, isLoading, error } = useProgrammesQuery()
  const preferred = useAppSelector((s) => user && s.ui.programmeByUser[user.id])
  const programmes = data?.filter((p) => user?.programmeIds.includes(p.id)) ?? []
  const programme = programmes.find((p) => p.id === preferred) ?? programmes[0]
  return { user, programmes, programme, isLoading, error }
}
