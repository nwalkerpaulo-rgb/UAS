import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export function useActiveSession() {
  const { user } = useAuth()
  const [activeSession, setActiveSession] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!user) {
      setActiveSession(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('service_sessions')
      .select('*')
      .eq('created_by', user.id)
      .eq('status', 'aberta')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!error) setActiveSession(data)
    setLoading(false)
  }, [user])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { activeSession, loading, refresh }
}
