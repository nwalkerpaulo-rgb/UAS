import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Card, Badge, EmptyState } from '../components/ui'
import QrCodeCard from '../components/QrCodeCard'

function secondsToHours(s) {
  return ((s || 0) / 3600).toFixed(1)
}

export default function DroneDetail() {
  const { id } = useParams()
  const [drone, setDrone] = useState(null)
  const [missions, setMissions] = useState([])
  const [maintenance, setMaintenance] = useState([])
  const [batteries, setBatteries] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: d }, { data: m }, { data: maint }, { data: bat }] = await Promise.all([
      supabase.from('drones').select('*').eq('id', id).single(),
      supabase
        .from('missions')
        .select('*, profiles!missions_pilot_id_fkey(full_name), batteries(model, serial_number)')
        .eq('drone_id', id)
        .order('created_at', { ascending: false }),
      supabase
        .from('maintenance_records')
        .select('*, profiles(full_name)')
        .eq('asset_type', 'drone')
        .eq('asset_id', id)
        .order('performed_at', { ascending: false }),
      supabase.from('batteries').select('*').eq('drone_id', id),
    ])
    setDrone(d)
    setMissions(m || [])
    setMaintenance(maint || [])
    setBatteries(bat || [])
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  if (loading) return <p className="text-muted text-sm">A carregar...</p>
  if (!drone) return <EmptyState title="Drone não encontrado" />

  const missionCount = missions.length
  const lastFlight = missions[0]?.created_at
  const pilotsInvolved = [...new Map(missions.filter((m) => m.profiles).map((m) => [m.pilot_id, m.profiles.full_name])).values()]

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link to="/drones" className="text-xs text-muted hover:text-ink">← Drones</Link>
        <div className="flex items-start justify-between flex-wrap gap-3 mt-2">
          <div>
            <h1 className="font-display text-xl font-semibold text-ink">{drone.name}</h1>
            <p className="text-muted text-sm">{drone.model} · S/N {drone.serial_number}</p>
          </div>
          <Badge status={drone.status}>{drone.status}</Badge>
        </div>
        <div className="mt-3">
          <QrCodeCard label={drone.name} />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <p className="mono text-xl text-cyan">{secondsToHours(drone.total_flight_seconds)}h</p>
          <p className="text-muted text-xs mt-1">Horas de voo</p>
        </Card>
        <Card>
          <p className="mono text-xl text-amber">{missionCount}</p>
          <p className="text-muted text-xs mt-1">Nº missões</p>
        </Card>
        <Card>
          <p className="mono text-sm text-ink">{lastFlight ? new Date(lastFlight).toLocaleDateString('pt-PT') : '—'}</p>
          <p className="text-muted text-xs mt-1">Último voo</p>
        </Card>
        <Card>
          <p className="mono text-sm text-ink">
            {drone.next_maintenance_at ? new Date(drone.next_maintenance_at).toLocaleDateString('pt-PT') : '—'}
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

      {pilotsInvolved.length > 0 && (
        <div>
          <p className="text-muted text-xs mb-2">Pilotos que operaram este drone</p>
          <div className="flex flex-wrap gap-2">
            {pilotsInvolved.map((name) => (
              <span key={name} className="text-xs bg-panel2 border border-border rounded-full px-3 py-1 text-ink">{name}</span>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-muted text-xs mb-2">Histórico de missões</p>
        {missions.length === 0 ? (
          <p className="text-muted text-xs">Sem missões registadas.</p>
        ) : (
          <div className="space-y-2">
            {missions.map((m) => (
              <Card key={m.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="text-ink">{m.profiles?.full_name || 'Piloto desconhecido'}</p>
                  <p className="mono text-xs text-muted mt-0.5">
                    {new Date(m.created_at).toLocaleDateString('pt-PT')}
                    {m.batteries ? ` · bateria ${m.batteries.serial_number}` : ''}
                  </p>
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
