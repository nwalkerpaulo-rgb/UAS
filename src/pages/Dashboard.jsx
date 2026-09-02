import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useActiveSession } from '../hooks/useActiveSession'
import { Card, Button, Badge, EmptyState } from '../components/ui'

function Kpi({ label, value, accent = 'text-ink', mono = true }) {
  return (
    <Card>
      <p className={`${mono ? 'mono' : ''} text-2xl ${accent}`}>{value}</p>
      <p className="text-muted text-xs mt-1">{label}</p>
    </Card>
  )
}

function readinessColor(score) {
  if (score >= 85) return 'text-ok'
  if (score >= 60) return 'text-amber'
  return 'text-alert'
}

function readinessLabel(score) {
  if (score >= 85) return 'Operacional'
  if (score >= 60) return 'Capacidade reduzida'
  return 'Capacidade degradada'
}

export default function Dashboard() {
  const { profile, isAdminOrManager } = useAuth()
  const { activeSession } = useActiveSession()
  const [recentSessions, setRecentSessions] = useState([])
  const [kpis, setKpis] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const sessionsQuery = supabase
        .from('service_sessions')
        .select('id, status, started_at, ended_at, start_location_label, created_by, profiles!service_sessions_created_by_fkey(full_name)')
        .order('started_at', { ascending: false })
        .limit(5)

      const [
        { data: sessions },
        { data: drones },
        { data: batteries },
        { data: missions },
        { data: pilots },
        { data: certs },
        { data: incidents },
      ] = await Promise.all([
        sessionsQuery,
        supabase.from('drones').select('id, status'),
        supabase.from('batteries').select('id, status'),
        supabase.from('missions').select('id, status, tipo_servico, flight_seconds'),
        supabase.from('profiles').select('id').eq('role', 'piloto'),
        supabase.from('certifications').select('profile_id, expires_at'),
        supabase.from('incidents').select('id, status'),
      ])

      setRecentSessions(sessions || [])

      const dronesTotal = drones?.length || 0
      const dronesOp = drones?.filter((d) => d.status === 'operacional').length || 0

      const batteriesTotal = batteries?.length || 0
      const batteriesOp = batteries?.filter((b) => b.status === 'operacional').length || 0

      const missionsTotal = missions?.length || 0
      const missionsOk = missions?.filter((m) => m.status === 'concluida').length || 0
      const missionsCuas = missions?.filter((m) => m.tipo_servico === 'C-UAS').length || 0
      const flightSeconds = (missions || []).reduce((sum, m) => sum + (m.flight_seconds || 0), 0)
      const successRate = missionsTotal > 0 ? Math.round((missionsOk / missionsTotal) * 100) : null

      const pilotsTotal = pilots?.length || 0
      const today = new Date()
      const pilotsWithValidCert = new Set(
        (certs || [])
          .filter((c) => !c.expires_at || new Date(c.expires_at) >= today)
          .map((c) => c.profile_id)
      )
      const pilotsValid = pilots?.filter((p) => pilotsWithValidCert.has(p.id)).length || 0

      const openIncidents = incidents?.filter((i) => i.status !== 'fechada').length || 0

      const pctDrones = dronesTotal > 0 ? dronesOp / dronesTotal : 1
      const pctBatteries = batteriesTotal > 0 ? batteriesOp / batteriesTotal : 1
      const pctPilots = pilotsTotal > 0 ? pilotsValid / pilotsTotal : 1
      const readiness = Math.round(((pctDrones + pctBatteries + pctPilots) / 3) * 100)

      setKpis({
        missionsTotal,
        flightHours: (flightSeconds / 3600).toFixed(1),
        dronesOp,
        dronesTotal,
        pilotsValid,
        pilotsTotal,
        batteriesOp,
        batteriesTotal,
        missionsCuas,
        alerts: openIncidents,
        successRate,
        readiness,
      })

      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">
            Olá, {profile?.full_name?.split(' ')[0] || 'operador'}
          </h1>
          <p className="text-muted text-sm mt-1">
            {new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>

        {!activeSession ? (
          <Link to="/sessoes/nova">
            <Button>+ Iniciar Serviço</Button>
          </Link>
        ) : (
          <Link to={`/sessoes/${activeSession.id}`}>
            <Button variant="secondary">Ver serviço em curso →</Button>
          </Link>
        )}
      </div>

      {loading || !kpis ? (
        <p className="text-muted text-sm">A carregar...</p>
      ) : (
        <>
          {/* Índice de prontidão */}
          <Card className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-muted text-xs mb-1">UAS READINESS</p>
              <p className={`mono text-4xl font-semibold ${readinessColor(kpis.readiness)}`}>{kpis.readiness}%</p>
            </div>
            <Badge status={kpis.readiness >= 85 ? 'operacional' : kpis.readiness >= 60 ? 'manutencao' : 'inativo'}>
              {readinessLabel(kpis.readiness)}
            </Badge>
          </Card>

          {/* Grid de KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Kpi label="Missões" value={kpis.missionsTotal} />
            <Kpi label="Horas de voo" value={`${kpis.flightHours}h`} accent="text-cyan" />
            <Kpi label="Drones operacionais" value={`${kpis.dronesOp} / ${kpis.dronesTotal}`} accent="text-amber" />
            <Kpi label="Pilotos válidos" value={`${kpis.pilotsValid} / ${kpis.pilotsTotal}`} accent="text-amber" />
            <Kpi label="Baterias disponíveis" value={`${kpis.batteriesOp} / ${kpis.batteriesTotal}`} accent="text-amber" />
            <Kpi label="Missões C-UAS" value={kpis.missionsCuas} accent="text-cyan" />
            <Link to="/alertas">
              <Kpi
                label="Alertas"
                value={kpis.alerts}
                accent={kpis.alerts > 0 ? 'text-alert' : 'text-ok'}
              />
            </Link>
            <Kpi
              label="Taxa de sucesso"
              value={kpis.successRate !== null ? `${kpis.successRate}%` : '—'}
              accent="text-ok"
            />
          </div>
        </>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-medium text-ink">
            {isAdminOrManager ? 'Serviços recentes (equipa)' : 'Os meus serviços recentes'}
          </h2>
          <Link to="/sessoes" className="text-xs text-cyan hover:underline">
            Ver todos →
          </Link>
        </div>

        {loading ? (
          <p className="text-muted text-sm">A carregar...</p>
        ) : recentSessions.length === 0 ? (
          <EmptyState
            title="Ainda não há serviços registados"
            hint="Inicia o primeiro serviço para começar a acumular dados."
          />
        ) : (
          <div className="space-y-2">
            {recentSessions.map((s) => (
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
                  </div>
                  <Badge status={s.status}>{s.status}</Badge>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
