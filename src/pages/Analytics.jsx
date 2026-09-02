import { useEffect, useMemo, useState } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { supabase } from '../lib/supabase'
import { Card } from '../components/ui'

const CHART_COLORS = { amber: '#F5B942', cyan: '#5EEAD4', ok: '#4ADE80', alert: '#E64C4C' }

function monthKey(d) {
  const date = new Date(d)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(key) {
  const [y, m] = key.split('-')
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('pt-PT', { month: 'short', year: '2-digit' })
}

function last12MonthKeys() {
  const keys = []
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return keys
}

function ChartCard({ title, children, height = 260 }) {
  return (
    <Card>
      <p className="text-muted text-xs mb-4">{title}</p>
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer>{children}</ResponsiveContainer>
      </div>
    </Card>
  )
}

const tooltipStyle = { background: '#0D0F14', border: '1px solid #262B36', borderRadius: 8, fontSize: 12, color: '#E5E9F0' }
const axisStyle = { fontSize: 11, fill: '#7A8AA6' }

export default function Analytics() {
  const [missions, setMissions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('missions')
        .select('id, created_at, status, category, flight_seconds, drone_id, pilot_id, drones(name), profiles!missions_pilot_id_fkey(full_name)')
      setMissions(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const monthly = useMemo(() => {
    const keys = last12MonthKeys()
    const counts = Object.fromEntries(keys.map((k) => [k, { key: k, missões: 0, concluídas: 0 }]))
    for (const m of missions) {
      const key = monthKey(m.created_at)
      if (!counts[key]) continue
      counts[key].missões += 1
      if (m.status === 'concluida') counts[key].concluídas += 1
    }
    return keys.map((k) => ({
      label: monthLabel(k),
      missões: counts[k].missões,
      taxa: counts[k].missões > 0 ? Math.round((counts[k].concluídas / counts[k].missões) * 100) : 0,
    }))
  }, [missions])

  const byPilot = useMemo(() => {
    const map = {}
    for (const m of missions) {
      const name = m.profiles?.full_name || 'Desconhecido'
      map[name] = map[name] || { name, horas: 0, missões: 0 }
      map[name].horas += (m.flight_seconds || 0) / 3600
      map[name].missões += 1
    }
    return Object.values(map)
      .sort((a, b) => b.horas - a.horas)
      .slice(0, 8)
      .map((p) => ({ ...p, horas: Number(p.horas.toFixed(1)) }))
  }, [missions])

  const byDrone = useMemo(() => {
    const map = {}
    for (const m of missions) {
      const name = m.drones?.name || 'Sem drone'
      map[name] = (map[name] || 0) + 1
    }
    return Object.entries(map)
      .map(([name, missões]) => ({ name, missões }))
      .sort((a, b) => b.missões - a.missões)
      .slice(0, 8)
  }, [missions])

  const byCategory = useMemo(() => {
    const map = {}
    for (const m of missions) {
      const cat = m.category || 'Sem categoria'
      map[cat] = (map[cat] || 0) + 1
    }
    return Object.entries(map).map(([name, missões]) => ({ name, missões })).sort((a, b) => b.missões - a.missões)
  }, [missions])

  if (loading) return <p className="text-muted text-sm">A carregar...</p>

  if (missions.length === 0) {
    return (
      <div className="space-y-5">
        <h1 className="font-display text-xl font-semibold text-ink">Análise</h1>
        <Card><p className="text-muted text-sm">Ainda não há missões suficientes para gerar estatísticas.</p></Card>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <h1 className="font-display text-xl font-semibold text-ink">Análise</h1>

      <ChartCard title="Missões por mês (últimos 12 meses)">
        <BarChart data={monthly}>
          <CartesianGrid strokeDasharray="3 3" stroke="#262B36" />
          <XAxis dataKey="label" tick={axisStyle} />
          <YAxis tick={axisStyle} allowDecimals={false} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="missões" fill={CHART_COLORS.amber} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartCard>

      <ChartCard title="Taxa de sucesso mensal (%)">
        <LineChart data={monthly}>
          <CartesianGrid strokeDasharray="3 3" stroke="#262B36" />
          <XAxis dataKey="label" tick={axisStyle} />
          <YAxis tick={axisStyle} domain={[0, 100]} />
          <Tooltip contentStyle={tooltipStyle} />
          <Line type="monotone" dataKey="taxa" stroke={CHART_COLORS.ok} strokeWidth={2} dot={false} />
        </LineChart>
      </ChartCard>

      <div className="grid sm:grid-cols-2 gap-4">
        <ChartCard title="Horas de voo por piloto (top 8)">
          <BarChart data={byPilot} layout="vertical" margin={{ left: 24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#262B36" />
            <XAxis type="number" tick={axisStyle} />
            <YAxis type="category" dataKey="name" tick={{ ...axisStyle, fontSize: 10 }} width={110} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="horas" fill={CHART_COLORS.cyan} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Missões por drone (top 8)">
          <BarChart data={byDrone} layout="vertical" margin={{ left: 24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#262B36" />
            <XAxis type="number" tick={axisStyle} allowDecimals={false} />
            <YAxis type="category" dataKey="name" tick={{ ...axisStyle, fontSize: 10 }} width={110} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="missões" fill={CHART_COLORS.amber} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ChartCard>
      </div>

      <ChartCard title="Missões por tipo" height={Math.max(200, byCategory.length * 36)}>
        <BarChart data={byCategory} layout="vertical" margin={{ left: 24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#262B36" />
          <XAxis type="number" tick={axisStyle} allowDecimals={false} />
          <YAxis type="category" dataKey="name" tick={{ ...axisStyle, fontSize: 10 }} width={130} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="missões" fill={CHART_COLORS.cyan} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ChartCard>
    </div>
  )
}
