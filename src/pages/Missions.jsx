import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Card, Badge, Select, EmptyState } from '../components/ui'

function secondsToDuration(s) {
  if (!s) return '—'
  const m = Math.floor(s / 60)
  return `${m}min`
}

export default function Missions() {
  const { isAdminOrManager } = useAuth()
  const [missions, setMissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('todas')

  useEffect(() => {
    async function load() {
      setLoading(true)
      let query = supabase
        .from('missions')
        .select('*, drones(name), profiles!missions_pilot_id_fkey(full_name)')
        .order('created_at', { ascending: false })

      if (statusFilter !== 'todas') query = query.eq('status', statusFilter)

      const { data } = await query
      setMissions(data || [])
      setLoading(false)
    }
    load()
  }, [statusFilter])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-display text-xl font-semibold text-ink">
          {isAdminOrManager ? 'Missões — equipa' : 'As minhas missões'}
        </h1>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="max-w-[180px]">
          <option value="todas">Todos os estados</option>
          <option value="concluida">Concluída</option>
          <option value="falhada">Falhada</option>
          <option value="cua">Cua</option>
        </Select>
      </div>

      {loading ? (
        <p className="text-muted text-sm">A carregar...</p>
      ) : missions.length === 0 ? (
        <EmptyState title="Sem missões para este filtro" />
      ) : (
        <div className="space-y-2">
          {missions.map((m) => (
            <Card key={m.id} className="flex items-center justify-between">
              <div>
                <p className="text-ink text-sm font-medium">{m.drones?.name || 'Sem drone'}</p>
                <p className="mono text-xs text-muted mt-0.5">
                  {new Date(m.created_at).toLocaleDateString('pt-PT')}
                  {isAdminOrManager && m.profiles ? ` · ${m.profiles.full_name}` : ''}
                  {' · '}{secondsToDuration(m.flight_seconds)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {m.origin === 'log_importado' && (
                  <span className="mono text-xs text-ok">log ✓</span>
                )}
                <Badge status={m.status}>{m.status}</Badge>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
