import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAppSettings } from '../hooks/useAppSettings'
import { Card, Badge } from '../components/ui'

function daysUntil(dateStr) {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

function estimateHealth(battery, maxCycles) {
  if (battery.health_pct != null) return battery.health_pct
  return Math.max(0, Math.round(100 - (battery.cycle_count / maxCycles) * 100))
}

const SEVERITY_ORDER = { critica: 0, alta: 1, media: 2 }
const SEVERITY_BADGE = { critica: 'inativo', alta: 'inativo', media: 'manutencao' }
const SEVERITY_DOT = { critica: 'bg-alert', alta: 'bg-alert', media: 'bg-amber' }

function AlertRow({ a }) {
  const content = (
    <Card className="flex items-start gap-3 hover:border-amber/40 transition-colors">
      <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${SEVERITY_DOT[a.severity]}`} />
      <div className="flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-ink text-sm font-medium">{a.title}</p>
          <Badge status={SEVERITY_BADGE[a.severity]}>{a.category}</Badge>
        </div>
        <p className="text-muted text-xs mt-1">{a.description}</p>
      </div>
    </Card>
  )
  return a.link ? <Link to={a.link}>{content}</Link> : content
}

export default function Alerts() {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const { settings } = useAppSettings()

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [
        { data: drones },
        { data: batteries },
        { data: systems },
        { data: certs },
        { data: missions },
      ] = await Promise.all([
        supabase.from('drones').select('*'),
        supabase.from('batteries').select('*, drones(name), counter_drone_systems(name)'),
        supabase.from('counter_drone_systems').select('*'),
        supabase.from('certifications').select('*, profiles(full_name)'),
        supabase.from('missions').select('id, scheduled_at, planning_status, tipo_servico'),
      ])

      const list = []

      // Drones indisponíveis
      for (const d of drones || []) {
        if (d.status !== 'operacional') {
          list.push({
            severity: d.status === 'inativo' ? 'alta' : 'media',
            category: 'Drone',
            title: `${d.name} — ${d.status}`,
            description: `Drone fora de serviço (${d.status}).`,
            link: `/drones/${d.id}`,
          })
        }
      }

      // Manutenção próxima/vencida — drones
      for (const d of drones || []) {
        const days = daysUntil(d.next_maintenance_at)
        if (days !== null && days < 0) {
          list.push({ severity: 'alta', category: 'Manutenção', title: `${d.name} — manutenção vencida`, description: `Vencida há ${Math.abs(days)} dia(s).`, link: `/drones/${d.id}` })
        } else if (days !== null && days <= settings.maintenance_warning_days) {
          list.push({ severity: 'media', category: 'Manutenção', title: `${d.name} — manutenção próxima`, description: `Em ${days} dia(s).`, link: `/drones/${d.id}` })
        }
      }

      // Manutenção próxima/vencida — sistemas C-UAS
      for (const s of systems || []) {
        const days = daysUntil(s.next_maintenance_at)
        if (days !== null && days < 0) {
          list.push({ severity: 'alta', category: 'Manutenção', title: `${s.name} — manutenção vencida`, description: `Vencida há ${Math.abs(days)} dia(s).`, link: `/contra-drone/${s.id}` })
        } else if (days !== null && days <= settings.maintenance_warning_days) {
          list.push({ severity: 'media', category: 'Manutenção', title: `${s.name} — manutenção próxima`, description: `Em ${days} dia(s).`, link: `/contra-drone/${s.id}` })
        }
        if (s.status !== 'operacional') {
          list.push({ severity: s.status === 'inativo' ? 'alta' : 'media', category: 'C-UAS', title: `${s.name} — ${s.status}`, description: 'Sistema fora de serviço.', link: `/contra-drone/${s.id}` })
        }
      }

      // Baterias críticas / degradadas
      for (const b of batteries || []) {
        const health = estimateHealth(b, settings.battery_max_cycles)
        const owner = b.drones?.name || b.counter_drone_systems?.name || 'sem equipamento fixo'
        if (health < 50 || b.status === 'inativo') {
          list.push({ severity: 'critica', category: 'Bateria', title: `${b.model} (${owner}) — crítica`, description: `Saúde estimada: ${health}/100.`, link: `/baterias/${b.id}` })
        } else if (health < 80) {
          list.push({ severity: 'media', category: 'Bateria', title: `${b.model} (${owner}) — degradada`, description: `Saúde estimada: ${health}/100.`, link: `/baterias/${b.id}` })
        }
      }

      // Habilitações expiradas / a expirar
      for (const c of certs || []) {
        const days = daysUntil(c.expires_at)
        if (days === null) continue
        const name = c.profiles?.full_name || 'Piloto'
        if (days < 0) {
          list.push({ severity: 'critica', category: 'Habilitação', title: `${name} — ${c.type} expirada`, description: `Expirou há ${Math.abs(days)} dia(s).` })
        } else if (days <= settings.cert_expiry_warning_days) {
          list.push({ severity: 'media', category: 'Habilitação', title: `${name} — ${c.type} a expirar`, description: `Expira em ${days} dia(s).` })
        }
      }

      // Alerta de capacidade — amanhã
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const tomorrowKey = tomorrow.toDateString()
      const tomorrowMissions = (missions || []).filter(
        (m) => m.scheduled_at && new Date(m.scheduled_at).toDateString() === tomorrowKey && ['planeada', 'pronta'].includes(m.planning_status)
      )
      const tomorrowUasMissions = tomorrowMissions.filter((m) => m.tipo_servico !== 'C-UAS').length
      const dronesAvailable = (drones || []).filter((d) => d.status === 'operacional').length
      if (tomorrowUasMissions > dronesAvailable) {
        list.push({
          severity: 'alta',
          category: 'Capacidade',
          title: 'Falta de drones amanhã',
          description: `${tomorrowUasMissions} missão(ões) planeada(s) mas só ${dronesAvailable} drone(s) operacional(is).`,
          link: '/missoes/planeamento',
        })
      }

      // Drones sem utilização há muito tempo
      list.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
      setAlerts(list)
      setLoading(false)
    }
    load()
  }, [settings])

  const critCount = alerts.filter((a) => a.severity === 'critica').length
  const altCount = alerts.filter((a) => a.severity === 'alta').length
  const medCount = alerts.filter((a) => a.severity === 'media').length

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-xl font-semibold text-ink">Alertas</h1>
        <p className="text-muted text-sm mt-1">Gerados automaticamente a partir do estado atual da frota, habilitações e planeamento.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card>
          <p className="mono text-xl text-alert">{critCount}</p>
          <p className="text-muted text-xs mt-1">Críticos</p>
        </Card>
        <Card>
          <p className="mono text-xl text-alert">{altCount}</p>
          <p className="text-muted text-xs mt-1">Altos</p>
        </Card>
        <Card>
          <p className="mono text-xl text-amber">{medCount}</p>
          <p className="text-muted text-xs mt-1">Médios</p>
        </Card>
      </div>

      {loading ? (
        <p className="text-muted text-sm">A carregar...</p>
      ) : alerts.length === 0 ? (
        <Card><p className="text-ok text-sm">✓ Sem alertas — tudo dentro dos limites normais.</p></Card>
      ) : (
        <div className="space-y-2">
          {alerts.map((a, i) => <AlertRow key={i} a={a} />)}
        </div>
      )}
    </div>
  )
}
