import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Card, Badge, Button, EmptyState } from '../components/ui'

const STATUS_LABEL = {
  planeada: 'Planeada',
  pronta: 'Pronta',
  em_curso: 'Em curso',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
}

const STATUS_BADGE = {
  planeada: 'manutencao',
  pronta: 'operacional',
  em_curso: 'aberta',
  concluida: 'operacional',
  cancelada: 'inativo',
}

export default function MissionPlans() {
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('missions')
      .select('*, drones(name), profiles!missions_pilot_id_fkey(full_name)')
      .in('planning_status', ['planeada', 'pronta', 'em_curso'])
      .order('scheduled_at', { ascending: true, nullsFirst: false })
    setPlans(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function advance(id, newStatus) {
    await supabase.from('missions').update({ planning_status: newStatus }).eq('id', id)
    await load()
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-display text-xl font-semibold text-ink">Planeamento de Missões</h1>
        <Link to="/missoes/planeamento/nova">
          <Button>+ Nova missão</Button>
        </Link>
      </div>

      {loading ? (
        <p className="text-muted text-sm">A carregar...</p>
      ) : plans.length === 0 ? (
        <EmptyState title="Sem missões planeadas" hint="Cria uma nova missão para começar o fluxo de planeamento." />
      ) : (
        <div className="space-y-2">
          {plans.map((m) => (
            <Card key={m.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-ink text-sm font-medium">{m.category || 'Missão'} · {m.drones?.name || '—'}</p>
                  <p className="mono text-xs text-muted mt-0.5">
                    {m.scheduled_at ? new Date(m.scheduled_at).toLocaleString('pt-PT') : 'Sem data definida'}
                    {' · '}{m.profiles?.full_name || '—'}
                    {m.area_label ? ` · ${m.area_label}` : ''}
                  </p>
                </div>
                <Badge status={STATUS_BADGE[m.planning_status]}>{STATUS_LABEL[m.planning_status]}</Badge>
              </div>

              <div className="flex items-center gap-2 mt-3">
                {m.planning_status === 'planeada' && (
                  <button className="text-xs text-cyan hover:underline" onClick={() => advance(m.id, 'pronta')}>Marcar como pronta</button>
                )}
                {(m.planning_status === 'planeada' || m.planning_status === 'pronta') && (
                  <button className="text-xs text-amber hover:underline" onClick={() => advance(m.id, 'em_curso')}>Iniciar</button>
                )}
                {m.planning_status === 'em_curso' && (
                  <button className="text-xs text-ok hover:underline" onClick={() => advance(m.id, 'concluida')}>Concluir</button>
                )}
                <button className="text-xs text-alert hover:underline" onClick={() => advance(m.id, 'cancelada')}>Cancelar</button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
