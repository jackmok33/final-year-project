import { useCallback, useEffect, useRef } from 'react'

/** Let an async handler finish its work without updating a screen that has been left. */
export function useIsMounted() {
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  return useCallback(() => mounted.current, [])
}
