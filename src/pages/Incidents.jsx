import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Card, Badge, Button, EmptyState } from '../components/ui'

const STATUS_LABEL = { reportada: 'Reportada', em_investigacao: 'Em investigação', fechada: 'Fechada' }

export default function Incidents() {
  const { isAdminOrManager } = useAuth()
  const [incidents, setIncidents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('incidents')
        .select('*, profiles!incidents_reported_by_fkey(full_name), incident_photos(id, photo_url)')
        .order('occurred_at', { ascending: false })
      setIncidents(data || [])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-display text-xl font-semibold text-ink">
          {isAdminOrManager ? 'Ocorrências — equipa' : 'As minhas ocorrências'}
        </h1>
        <Link to="/incidentes/nova">
          <Button>+ Registar ocorrência</Button>
        </Link>
      </div>

      {loading ? (
        <p className="text-muted text-sm">A carregar...</p>
      ) : incidents.length === 0 ? (
        <EmptyState title="Sem ocorrências registadas" hint="Bom sinal." />
      ) : (
        <div className="space-y-2">
          {incidents.map((inc) => (
            <Link key={inc.id} to={`/incidentes/${inc.id}`}>
              <Card className="hover:border-amber/40 transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-ink text-sm font-medium">{inc.title || inc.description}</p>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge status={inc.severity}>{inc.severity}</Badge>
                    <Badge status={inc.status === 'fechada' ? 'operacional' : inc.status === 'em_investigacao' ? 'manutencao' : 'aberta'}>
                      {STATUS_LABEL[inc.status] || 'Reportada'}
                    </Badge>
                  </div>
                </div>
                <p className="mono text-xs text-muted mt-1">
                  {new Date(inc.occurred_at).toLocaleString('pt-PT')}
                  {isAdminOrManager && inc.profiles ? ` · ${inc.profiles.full_name}` : ''}
                  {inc.location_label ? ` · ${inc.location_label}` : ''}
                </p>
                {inc.incident_photos?.length > 0 && (
                  <div className="flex gap-2 mt-2">
                    {inc.incident_photos.slice(0, 4).map((p) => (
                      <img key={p.id} src={p.photo_url} alt="" className="w-14 h-14 rounded-lg border border-border object-cover" />
                    ))}
                  </div>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
