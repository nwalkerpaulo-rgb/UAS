import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Card, Badge, Button, EmptyState, Select } from '../components/ui'

export default function SessionsList() {
  const { isAdminOrManager } = useAuth()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('todas')

  useEffect(() => {
    async function load() {
      setLoading(true)
      let query = supabase
        .from('service_sessions')
        .select('id, status, started_at, ended_at, start_location_label, start_lat, start_lng, profiles!service_sessions_created_by_fkey(full_name)')
        .order('started_at', { ascending: false })

      if (statusFilter !== 'todas') query = query.eq('status', statusFilter)

      const { data } = await query
      setSessions(data || [])
      setLoading(false)
    }
    load()
  }, [statusFilter])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-display text-xl font-semibold text-ink">
          {isAdminOrManager ? 'Sessões — equipa' : 'As minhas sessões'}
        </h1>
        <Link to="/sessoes/nova">
          <Button>+ Iniciar Serviço</Button>
        </Link>
      </div>

      <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="max-w-[200px]">
        <option value="todas">Todos os estados</option>
        <option value="aberta">Aberta</option>
        <option value="fechada">Fechada (aguarda log)</option>
        <option value="completa">Completa</option>
      </Select>

      {loading ? (
        <p className="text-muted text-sm">A carregar...</p>
      ) : sessions.length === 0 ? (
        <EmptyState title="Sem sessões para este filtro" />
      ) : (
        <div className="space-y-2">
          {sessions.map((s) => (
            <Link key={s.id} to={`/sessoes/${s.id}`}>
              <Card className="flex items-center justify-between hover:border-amber/40 transition-colors">
                <div>
                  <p className="text-ink text-sm font-medium">
                    {s.start_location_label || 'Localização não confirmada'}
                  </p>
                  <p className="mono text-xs text-muted mt-0.5">
                    {new Date(s.started_at).toLocaleString('pt-PT')}
                    {isAdminOrManager && s.profiles ? ` · ${s.profiles.full_name}` : ''}
                  </p>
                  {s.start_lat && (
                    <p className="mono text-xs text-cyan mt-0.5">
                      {s.start_lat.toFixed(4)}, {s.start_lng.toFixed(4)}
                    </p>
                  )}
                </div>
                <Badge status={s.status}>{s.status}</Badge>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
