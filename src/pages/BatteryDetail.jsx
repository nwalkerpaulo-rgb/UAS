import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAppSettings } from '../hooks/useAppSettings'
import { Card, Badge, EmptyState } from '../components/ui'
import QrCodeCard from '../components/QrCodeCard'

function secondsToHours(s) {
  return ((s || 0) / 3600).toFixed(1)
}

// Estimativa simples de saúde da bateria: usa health_pct se existir (vindo de
// leituras reais do log); caso contrário, estima a partir dos ciclos, usando
// o limite definido em Configurações → Definições da organização.
// É só uma estimativa — não substitui os dados reais do fabricante.
function estimateHealth(battery, maxCycles) {
  if (battery.health_pct != null) return battery.health_pct
  return Math.max(0, Math.round(100 - (battery.cycle_count / maxCycles) * 100))
}

function healthColor(score) {
  if (score >= 80) return 'text-ok'
  if (score >= 50) return 'text-amber'
  return 'text-alert'
}

export default function BatteryDetail() {
  const { settings } = useAppSettings()
  const { id } = useParams()
  const [battery, setBattery] = useState(null)
  const [missions, setMissions] = useState([])
  const [maintenance, setMaintenance] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: b }, { data: m }, { data: maint }] = await Promise.all([
      supabase.from('batteries').select('*, drones(name)').eq('id', id).single(),
      supabase
        .from('missions')
        .select('*, profiles!missions_pilot_id_fkey(full_name), drones(name)')
        .eq('battery_id', id)
        .order('created_at', { ascending: false }),
      supabase
        .from('maintenance_records')
        .select('*, profiles(full_name)')
        .eq('asset_type', 'bateria')
        .eq('asset_id', id)
        .order('performed_at', { ascending: false }),
    ])
    setBattery(b)
    setMissions(m || [])
    setMaintenance(maint || [])
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  if (loading) return <p className="text-muted text-sm">A carregar...</p>
  if (!battery) return <EmptyState title="Bateria não encontrada" />

  const health = estimateHealth(battery, settings.battery_max_cycles)

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link to="/baterias" className="text-xs text-muted hover:text-ink">← Baterias</Link>
        <div className="flex items-start justify-between flex-wrap gap-3 mt-2">
          <div>
            <h1 className="font-display text-xl font-semibold text-ink">{battery.model}</h1>
            <p className="text-muted text-sm">S/N {battery.serial_number} {battery.drones ? `· ${battery.drones.name}` : ''}</p>
          </div>
          <Badge status={battery.status}>{battery.status}</Badge>
        </div>
        <div className="mt-3">
          <QrCodeCard label={battery.serial_number} />
        </div>
      </div>

      <Card className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <p className="text-muted text-xs mb-1">BATTERY HEALTH SCORE {battery.health_pct == null && '(estimado)'}</p>
          <p className={`mono text-4xl font-semibold ${healthColor(health)}`}>{health}<span className="text-lg text-muted">/100</span></p>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <Card>
          <p className="mono text-xl text-amber">{battery.cycle_count}</p>
          <p className="text-muted text-xs mt-1">Ciclos</p>
        </Card>
        <Card>
          <p className="mono text-xl text-cyan">{secondsToHours(battery.total_flight_seconds)}h</p>
          <p className="text-muted text-xs mt-1">Horas de voo</p>
        </Card>
        <Card>
          <p className="mono text-sm text-ink">
            {battery.next_maintenance_cycles ?? '—'}
          </p>
          <p className="text-muted text-xs mt-1">Próx. manutenção (ciclos)</p>
        </Card>
      </div>

      <div>
        <p className="text-muted text-xs mb-2">Histórico de utilização</p>
        {missions.length === 0 ? (
          <p className="text-muted text-xs">Sem missões registadas com esta bateria.</p>
        ) : (
          <div className="space-y-2">
            {missions.map((m) => (
              <Card key={m.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="text-ink">{m.drones?.name || 'Drone'} · {m.profiles?.full_name || '—'}</p>
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
