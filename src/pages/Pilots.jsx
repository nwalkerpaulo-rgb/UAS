import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Card, Button, Select, EmptyState } from '../components/ui'

function daysUntil(dateStr) {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

function ExpiryLine({ date }) {
  if (!date) return <p className="mono text-xs text-muted mt-2">Sem validade de habilitação registada</p>
  const days = daysUntil(date)
  const label = new Date(date).toLocaleDateString('pt-PT')
  if (days < 0) return <p className="mono text-xs text-alert mt-2">Habilitação mais próxima expirou em {label}</p>
  if (days <= 30) return <p className="mono text-xs text-amber mt-2">Próxima validade: {label} ({days}d)</p>
  return <p className="mono text-xs text-muted mt-2">Próxima validade: {label}</p>
}

function toCsv(rows, headers) {
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  return [headers.map(escape).join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\n')
}

function downloadCsv(filename, csv) {
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function Pilots() {
  const [pilots, setPilots] = useState([])
  const [certsByUser, setCertsByUser] = useState({})
  const [loading, setLoading] = useState(true)
  const [courseFilter, setCourseFilter] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [{ data: profiles }, { data: certs }, { data: missions }] = await Promise.all([
        supabase.from('profiles').select('*').eq('role', 'piloto').order('full_name'),
        supabase.from('certifications').select('*'),
        supabase.from('missions').select('pilot_id, flight_seconds'),
      ])

      const grouped = {}
      for (const c of certs || []) {
        grouped[c.profile_id] = grouped[c.profile_id] || []
        grouped[c.profile_id].push(c)
      }
      setCertsByUser(grouped)

      const missionStats = {}
      for (const m of missions || []) {
        const s = missionStats[m.pilot_id] || { count: 0, seconds: 0 }
        s.count += 1
        s.seconds += m.flight_seconds || 0
        missionStats[m.pilot_id] = s
      }

      const merged = (profiles || []).map((p) => {
        const userCerts = grouped[p.id] || []
        const nearestExpiry = userCerts.map((c) => c.expires_at).filter(Boolean).sort()[0]
        return {
          ...p,
          certCount: userCerts.length,
          nearestExpiry,
          missionCount: missionStats[p.id]?.count || 0,
          flightSeconds: missionStats[p.id]?.seconds || 0,
        }
      })

      setPilots(merged)
      setLoading(false)
    }
    load()
  }, [])

  const courseOptions = useMemo(() => {
    const set = new Set()
    Object.values(certsByUser).forEach((list) => list.forEach((c) => c.type && set.add(c.type)))
    return Array.from(set).sort()
  }, [certsByUser])

  const filteredPilots = useMemo(() => {
    if (!courseFilter) return pilots
    return pilots.filter((p) => (certsByUser[p.id] || []).some((c) => c.type === courseFilter))
  }, [pilots, certsByUser, courseFilter])

  function exportList() {
    const rows = filteredPilots.map((p) => {
      const cert = (certsByUser[p.id] || []).find((c) => c.type === courseFilter)
      return {
        nome: p.full_name,
        email: p.email,
        nm: p.nm || '',
        posto: p.posto || '',
        subunidade: p.subunidade || '',
        curso: courseFilter,
        nº_certificado: cert?.certificate_number || '',
        validade: cert?.expires_at || '',
      }
    })
    downloadCsv(
      `pilotos_${courseFilter.replace(/[^a-z0-9]+/gi, '_')}.csv`,
      toCsv(rows, ['nome', 'email', 'nm', 'posto', 'subunidade', 'curso', 'nº_certificado', 'validade'])
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold text-ink">Pilotos</h1>
          <p className="text-muted text-sm mt-1">
            {filteredPilots.length} de {pilots.length} piloto{pilots.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link to="/pilotos/novo">
          <Button>+ Criar Piloto</Button>
        </Link>
      </div>

      {courseOptions.length > 0 && (
        <Card className="flex flex-wrap items-end gap-3">
          <div className="w-64">
            <Select label="Filtrar por curso / habilitação" value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}>
              <option value="">Todos</option>
              {courseOptions.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>
          {courseFilter && (
            <Button variant="secondary" onClick={exportList}>Exportar lista (CSV)</Button>
          )}
        </Card>
      )}

      {loading ? (
        <p className="text-muted text-sm">A carregar...</p>
      ) : filteredPilots.length === 0 ? (
        <EmptyState
          title={courseFilter ? `Ninguém tem "${courseFilter}"` : 'Sem pilotos registados'}
          hint={!courseFilter ? "Cria uma conta em Utilizadores e define a função como 'piloto'." : undefined}
        />
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {filteredPilots.map((p) => (
            <Link key={p.id} to={`/pilotos/${p.id}`}>
              <Card className="hover:border-amber/40 transition-colors">
                <p className="text-ink font-medium">{p.full_name}</p>
                <p className="text-muted text-xs mono">{p.email}</p>
                <div className="mt-3 grid grid-cols-3 gap-2 mono text-xs">
                  <div>
                    <p className="text-muted">Habilitações</p>
                    <p className="text-amber">{p.certCount}</p>
                  </div>
                  <div>
                    <p className="text-muted">Missões</p>
                    <p className="text-cyan">{p.missionCount}</p>
                  </div>
                  <div>
                    <p className="text-muted">Horas voo</p>
                    <p className="text-cyan">{(p.flightSeconds / 3600).toFixed(1)}h</p>
                  </div>
                </div>
                <ExpiryLine date={p.nearestExpiry} />
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
