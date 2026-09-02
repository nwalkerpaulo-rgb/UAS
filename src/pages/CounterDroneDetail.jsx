import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Card, Badge, EmptyState } from '../components/ui'
import QrCodeCard from '../components/QrCodeCard'

const CLASS_LABEL = {
  identificada_autorizada: 'Identificada / Autorizada',
  suspeita: 'Suspeita',
  nao_identificada: 'Não identificada',
}
const CLASS_BADGE = {
  identificada_autorizada: 'operacional',
  suspeita: 'manutencao',
  nao_identificada: 'inativo',
}

export default function CounterDroneDetail() {
  const { id } = useParams()
  const [system, setSystem] = useState(null)
  const [missions, setMissions] = useState([])
  const [detections, setDetections] = useState([])
  const [batteries, setBatteries] = useState([])
  const [maintenance, setMaintenance] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: s }, { data: m }, { data: det }, { data: bat }, { data: maint }] = await Promise.all([
      supabase.from('counter_drone_systems').select('*').eq('id', id).single(),
      supabase
        .from('missions')
        .select('*, profiles!missions_pilot_id_fkey(full_name)')
        .eq('counter_drone_system_id', id)
        .order('created_at', { ascending: false }),
      supabase
        .from('detections')
        .select('*, profiles!detections_operator_id_fkey(full_name)')
        .eq('system_id', id)
        .order('occurred_at', { ascending: false }),
      supabase.from('batteries').select('*').eq('counter_drone_system_id', id),
      supabase
        .from('maintenance_records')
        .select('*, profiles(full_name)')
        .eq('asset_type', 'contra_drone')
        .eq('asset_id', id)
        .order('performed_at', { ascending: false }),
    ])
    setSystem(s)
    setMissions(m || [])
    setDetections(det || [])
    setBatteries(bat || [])
    setMaintenance(maint || [])
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  if (loading) return <p className="text-muted text-sm">A carregar...</p>
  if (!system) return <EmptyState title="Sistema não encontrado" />

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link to="/contra-drone" className="text-xs text-muted hover:text-ink">← Sistemas C-UAS</Link>
        <div className="flex items-start justify-between flex-wrap gap-3 mt-2">
          <div>
            <h1 className="font-display text-xl font-semibold text-ink">{system.name}</h1>
            <p className="text-muted text-sm">{system.model} · S/N {system.serial_number} {system.system_type ? `· ${system.system_type}` : ''}</p>
          </div>
          <Badge status={system.status}>{system.status}</Badge>
        </div>
        <div className="mt-3">
          <QrCodeCard label={system.name} />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <p className="mono text-xl text-amber">{missions.length}</p>
          <p className="text-muted text-xs mt-1">Missões</p>
        </Card>
        <Card>
          <p className="mono text-xl text-cyan">{detections.length}</p>
          <p className="text-muted text-xs mt-1">Deteções</p>
        </Card>
        <Card>
          <p className="mono text-xl text-alert">{detections.filter((d) => d.classification !== 'identificada_autorizada').length}</p>
          <p className="text-muted text-xs mt-1">Suspeitas / não identificadas</p>
        </Card>
        <Card>
          <p className="mono text-sm text-ink">
            {system.next_maintenance_at ? new Date(system.next_maintenance_at).toLocaleDateString('pt-PT') : '—'}
          </p>
          <p className="text-muted text-xs mt-1">Próxima manutenção</p>
        </Card>
      </div>

      {batteries.length > 0 && (
        <div>
          <p className="text-muted text-xs mb-2">Baterias associadas</p>
          <div className="flex flex-wrap gap-2">
            {batteries.map((b) => (
              <Link key={b.id} to={`/baterias/${b.id}`}>
                <span className="text-xs bg-panel2 border border-border rounded-full px-3 py-1 text-ink hover:border-amber/40">
                  {b.model} · {b.serial_number}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-muted text-xs mb-2">Deteções feitas com este sistema</p>
        {detections.length === 0 ? (
          <p className="text-muted text-xs">Sem deteções registadas.</p>
        ) : (
          <div className="space-y-2">
            {detections.slice(0, 10).map((d) => (
              <Card key={d.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="text-ink">{d.detection_type || 'Deteção'} · {d.profiles?.full_name || '—'}</p>
                  <p className="mono text-xs text-muted mt-0.5">{new Date(d.occurred_at).toLocaleString('pt-PT')}</p>
                </div>
                <Badge status={CLASS_BADGE[d.classification]}>{CLASS_LABEL[d.classification]}</Badge>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="text-muted text-xs mb-2">Histórico de missões</p>
        {missions.length === 0 ? (
          <p className="text-muted text-xs">Sem missões registadas.</p>
        ) : (
          <div className="space-y-2">
            {missions.map((m) => (
              <Card key={m.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="text-ink">{m.profiles?.full_name || 'Operador desconhecido'}</p>
                  <p className="mono text-xs text-muted mt-0.5">{new Date(m.created_at).toLocaleDateString('pt-PT')}</p>
                </div>
                <Badge status={m.status}>{m.status}</Badge>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="text-muted text-xs mb-2">Histórico de manutenção</p>
        {maintenance.length === 0 ? (
          <p className="text-muted text-xs">Sem manutenções registadas.</p>
        ) : (
          <div className="space-y-2">
            {maintenance.map((rec) => (
              <Card key={rec.id} className="text-sm">
                <p className="text-ink">{rec.description}</p>
                <p className="mono text-xs text-muted mt-1">
                  {new Date(rec.performed_at).toLocaleDateString('pt-PT')}
                  {rec.profiles ? ` · ${rec.profiles.full_name}` : ''}
                </p>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
