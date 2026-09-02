import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Card, Button, Input } from '../components/ui'

function toCsv(rows, headers) {
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const lines = [headers.map(escape).join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))]
  return lines.join('\n')
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

export default function Reports() {
  const today = new Date().toISOString().slice(0, 10)
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)

  const [dateFrom, setDateFrom] = useState(firstOfMonth)
  const [dateTo, setDateTo] = useState(today)
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState(null)
  const [missionsRaw, setMissionsRaw] = useState([])

  async function generate() {
    setLoading(true)
    const fromIso = new Date(dateFrom).toISOString()
    const toIso = new Date(new Date(dateTo).getTime() + 86400000).toISOString() // inclui o dia todo

    const [{ data: missions }, { data: incidents }] = await Promise.all([
      supabase
        .from('missions')
        .select('id, created_at, status, category, tipo_servico, flight_seconds, distance_meters, area_label, drones(name), profiles!missions_pilot_id_fkey(full_name)')
        .gte('created_at', fromIso)
        .lt('created_at', toIso),
      supabase
        .from('incidents')
        .select('id, severity, status, occurred_at')
        .gte('occurred_at', fromIso)
        .lt('occurred_at', toIso),
    ])

    const m = missions || []
    const inc = incidents || []

    const dronesUsados = new Set(m.filter((x) => x.drones).map((x) => x.drones.name)).size
    const pilotosEnvolvidos = new Set(m.filter((x) => x.profiles).map((x) => x.profiles.full_name)).size
    const missoesCuas = m.filter((x) => x.tipo_servico === 'C-UAS').length
    const flightSeconds = m.reduce((sum, x) => sum + (x.flight_seconds || 0), 0)
    const distanceTotal = m.reduce((sum, x) => sum + (x.distance_meters || 0), 0)
    const concluidas = m.filter((x) => x.status === 'concluida').length

    const porCategoria = {}
    for (const x of m) {
      const cat = x.category || 'Sem categoria'
      porCategoria[cat] = (porCategoria[cat] || 0) + 1
    }

    setReport({
      periodo: `${new Date(dateFrom).toLocaleDateString('pt-PT')} — ${new Date(dateTo).toLocaleDateString('pt-PT')}`,
      totalMissoes: m.length,
      concluidas,
      taxaSucesso: m.length > 0 ? Math.round((concluidas / m.length) * 100) : null,
      horasVoo: (flightSeconds / 3600).toFixed(1),
      distanciaKm: (distanceTotal / 1000).toFixed(1),
      dronesUsados,
      pilotosEnvolvidos,
      missoesCuas,
      incidentes: inc.length,
      incidentesAbertos: inc.filter((i) => i.status !== 'fechada').length,
      porCategoria,
    })
    setMissionsRaw(m)
    setLoading(false)
  }

  function exportCsv() {
    const csv = toCsv(
      missionsRaw.map((m) => ({
        data: new Date(m.created_at).toLocaleDateString('pt-PT'),
        drone: m.drones?.name || '',
        piloto: m.profiles?.full_name || '',
        tipo_servico: m.tipo_servico || '',
        categoria: m.category || '',
        estado: m.status,
        local: m.area_label || '',
        tempo_voo_min: m.flight_seconds ? Math.round(m.flight_seconds / 60) : '',
        distancia_m: m.distance_metros || m.distance_meters || '',
      })),
      ['data', 'drone', 'piloto', 'tipo_servico', 'categoria', 'estado', 'local', 'tempo_voo_min', 'distancia_m']
    )
    downloadCsv(`relatorio_missoes_${dateFrom}_a_${dateTo}.csv`, csv)
  }

  return (
    <div className="space-y-5">
      <h1 className="font-display text-xl font-semibold text-ink">Relatório Executivo</h1>

      <Card className="flex flex-wrap items-end gap-3 print:hidden">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted">Período — de</span>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="focus-ring bg-panel2 border border-border rounded-lg px-3 py-1.5 text-sm text-ink" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted">até</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="focus-ring bg-panel2 border border-border rounded-lg px-3 py-1.5 text-sm text-ink" />
        </div>
        <Button onClick={generate} disabled={loading}>{loading ? 'A gerar...' : 'Gerar relatório'}</Button>
        {report && (
          <>
            <Button variant="secondary" onClick={exportCsv}>Exportar CSV</Button>
            <Button variant="secondary" onClick={() => window.print()}>Imprimir / Guardar PDF</Button>
          </>
        )}
      </Card>

      {report && (
        <div className="space-y-4" id="report-print-area">
          <div className="hidden print:block mb-4">
            <h2 className="font-display text-lg font-bold">GIOP UAS C-UAS Operações — Relatório Executivo</h2>
            <p className="text-sm">{report.periodo}</p>
          </div>

          <Card>
            <p className="text-muted text-xs mb-3">Período: {report.periodo}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="mono text-xl text-amber">{report.totalMissoes}</p>
                <p className="text-muted text-xs">Missões</p>
              </div>
              <div>
                <p className="mono text-xl text-ok">{report.taxaSucesso !== null ? `${report.taxaSucesso}%` : '—'}</p>
                <p className="text-muted text-xs">Taxa de sucesso</p>
              </div>
              <div>
                <p className="mono text-xl text-cyan">{report.horasVoo}h</p>
                <p className="text-muted text-xs">Horas de voo</p>
              </div>
              <div>
                <p className="mono text-xl text-cyan">{report.distanciaKm}km</p>
                <p className="text-muted text-xs">Distância total</p>
              </div>
              <div>
                <p className="mono text-xl text-ink">{report.dronesUsados}</p>
                <p className="text-muted text-xs">Drones utilizados</p>
              </div>
              <div>
                <p className="mono text-xl text-ink">{report.pilotosEnvolvidos}</p>
                <p className="text-muted text-xs">Pilotos envolvidos</p>
              </div>
              <div>
                <p className="mono text-xl text-ink">{report.missoesCuas}</p>
                <p className="text-muted text-xs">Missões C-UAS</p>
              </div>
              <div>
                <p className="mono text-xl text-alert">{report.incidentes}</p>
                <p className="text-muted text-xs">Incidentes ({report.incidentesAbertos} em aberto)</p>
              </div>
            </div>
          </Card>

          <Card>
            <p className="text-muted text-xs mb-3">Distribuição por tipo</p>
            <div className="space-y-1.5">
              {Object.entries(report.porCategoria).map(([cat, count]) => (
                <div key={cat} className="flex items-center justify-between text-sm">
                  <span className="text-ink">{cat}</span>
                  <span className="mono text-amber">{count}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {!report && !loading && (
        <Card><p className="text-muted text-sm">Escolhe um período e gera o relatório.</p></Card>
      )}
    </div>
  )
}
