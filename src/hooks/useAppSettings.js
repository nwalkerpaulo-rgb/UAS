import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export const DEFAULT_SETTINGS = {
  cert_expiry_warning_days: 30,
  maintenance_warning_days: 7,
  wind_gust_limit_ms: 10,
  battery_max_cycles: 300,
}

export function useAppSettings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)

  async function refresh() {
    setLoading(true)
    const { data } = await supabase.from('app_settings').select('*').eq('id', 'default').maybeSingle()
    if (data) setSettings(data)
    setLoading(false)
  }

  useEffect(() => { refresh() }, [])

  return { settings, loading, refresh }
}
