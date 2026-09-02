import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Marker, Popup } from 'react-leaflet'
import { Link } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase } from '../lib/supabase'
import { Card, Badge, Select } from '../components/ui'

const DEFAULT_CENTER = [39.5, -8.0] // Portugal continental
const DEFAULT_ZOOM = 7

const MISSION_COLOR = { concluida: '#4ADE80', falhada: '#E64C4C', cua: '#E64C4C' }
const INCIDENT_COLOR = { baixa: '#7A8AA6', media: '#F5B942', alta: '#E64C4C', critica: '#E64C4C' }
const SESSION_COLOR = '#5EEAD4'
const DETECTION_COLOR = { identificada_autorizada: '#4ADE80', suspeita: '#F5B942', nao_identificada: '#E64C4C' }

const baseIcon = L.divIcon({
  className: '',
  html: `<div style="width:16px;height:16px;background:#F5B942;border:2px solid #0D0F14;transform:rotate(45deg);box-shadow:0 0 4px rgba(0,0,0,0.5)"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
})

function fmtDate(d) {
  return new Date(d).toLocaleDateString('pt-PT')
}

export default function MapView() {
  const [missions, setMissions] = useState([])
  const [incidents, setIncidents] = useState([])
  const [sessions, setSessions] = useState([])
  const [detections, setDetections] = useState([])
  const [bases, setBases] = useState([])
  const [pilots, setPilots] = useState([])
  const [loading, setLoading] = useState(true)

  // layers
  const [showMissions, setShowMissions] = useState(true)
  const [showIncidents, setShowIncidents] = useState(true)
  const [showSessions, setShowSessions] = useState(false)
  const [showDetections, setShowDetections] = useState(true)
  const [showBases, setShowBases] = useState(true)

  // filtros
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [pilotFilter, setPilotFilter] = useState('')
  const [tipoFilter, setTipoFilter] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [{ data: m }, { data: inc }, { data: s }, { data: det }, { data: bs }, { data: p }] = await Promise.all([
        supabase
          .from('missions')
          .select('id, lat, lng, status, tipo_servico, area_label, created_at, pilot_id, profiles!missions_pilot_id_fkey(full_name), drones(name)')
          .not('lat', 'is', null),
        supabase
          .from('incidents')
          .select('id, lat, lng, severity, title, description, occurred_at')
          .not('lat', 'is', null),
        supabase
          .from('service_sessions')
          .select('id, start_lat, start_lng, started_at, start_location_label')
          .not('start_lat', 'is', null),
        supabase
          .from('detections')
          .select('id, lat, lng, classification, detection_type, location_label, occurred_at, counter_drone_systems(name)')
          .not('lat', 'is', null),
        supabase.from('bases').select('*'),
        supabase.from('profiles').select('id, full_name').eq('role', 'piloto').order('full_name'),
      ])
      setMissions(m || [])
      setIncidents(inc || [])
      setSessions(s || [])
      setDetections(det || [])
      setBases(bs || [])
      setPilots(p || [])
      setLoading(false)
    }
    load()
  }, [])

  const filteredMissions = useMemo(() => {
    return missions.filter((m) => {
      if (dateFrom && new Date(m.created_at) < new Date(dateFrom)) return false
      if (dateTo && new Date(m.created_at) > new Date(dateTo)) return false
      if (pilotFilter && m.pilot_id !== pilotFilter) return false
      if (tipoFilter && m.tipo_servico !== tipoFilter) return false
      return true
    })
  }, [missions, dateFrom, dateTo, pilotFilter, tipoFilter])

  const filteredIncidents = useMemo(() => {
    return incidents.filter((i) => {
      if (dateFrom && new Date(i.occurred_at) < new Date(dateFrom)) return false
      if (dateTo && new Date(i.occurred_at) > new Date(dateTo)) return false
      return true
    })
  }, [incidents, dateFrom, dateTo])

  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (dateFrom && new Date(s.started_at) < new Date(dateFrom)) return false
      if (dateTo && new Date(s.started_at) > new Date(dateTo)) return false
      return true
    })
  }, [sessions, dateFrom, dateTo])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-display text-xl font-semibold text-ink">Mapa Operacional</h1>
        <div className="flex items-center gap-2 text-xs">
          <label className="flex items-center gap-1.5 text-muted">
            <input type="checkbox" className="accent-ok" checked={showMissions} onChange={(e) => setShowMissions(e.target.checked)} />
            Missões
          </label>
          <label className="flex items-center gap-1.5 text-muted">
            <input type="checkbox" className="accent-alert" checked={showIncidents} onChange={(e) => setShowIncidents(e.target.checked)} />
            Incidentes
          </label>
          <label className="flex items-center gap-1.5 text-muted">
            <input type="checkbox" className="accent-cyan" checked={showSessions} onChange={(e) => setShowSessions(e.target.checked)} />
            Sessões
          </label>
          <label className="flex items-center gap-1.5 text-muted">
            <input type="checkbox" className="accent-amber" checked={showDetections} onChange={(e) => setShowDetections(e.target.checked)} />
            Deteções
          </label>
          <label className="flex items-center gap-1.5 text-muted">
            <input type="checkbox" className="accent-amber" checked={showBases} onChange={(e) => setShowBases(e.target.checked)} />
            Bases
          </label>
        </div>
      </div>

      {/* Filtros */}
      <Card className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted">De</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="focus-ring bg-panel2 border border-border rounded-lg px-3 py-1.5 text-sm text-ink"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted">Até</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="focus-ring bg-panel2 border border-border rounded-lg px-3 py-1.5 text-sm text-ink"
          />
        </div>
        <div className="flex-1 min-w-[160px]">
          <Select label="Piloto" value={pilotFilter} onChange={(e) => setPilotFilter(e.target.value)}>
            <option value="">Todos</option>
            {pilots.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </Select>
        </div>
        <div className="flex-1 min-w-[140px]">
          <Select label="Tipo" value={tipoFilter} onChange={(e) => setTipoFilter(e.target.value)}>
            <option value="">Todos</option>
            <option value="UAS">UAS</option>
            <option value="C-UAS">C-UAS</option>
          </Select>
        </div>
        {(dateFrom || dateTo || pilotFilter || tipoFilter) && (
          <button
            className="text-xs text-cyan hover:underline pb-2"
            onClick={() => { setDateFrom(''); setDateTo(''); setPilotFilter(''); setTipoFilter('') }}
          >
            Limpar filtros
          </button>
        )}
      </Card>

      {loading ? (
        <p className="text-muted text-sm">A carregar mapa...</p>
      ) : (
        <div className="rounded-xl overflow-hidden border border-border" style={{ height: '65vh' }}>
          <MapContainer center={DEFAULT_CENTER} zoom={DEFAULT_ZOOM} style={{ height: '100%', width: '100%', background: '#0D0F14' }}>
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            />

            {showMissions && filteredMissions.map((m) => (
              <CircleMarker
                key={`m-${m.id}`}
                center={[m.lat, m.lng]}
                radius={7}
                pathOptions={{ color: MISSION_COLOR[m.status] || '#F5B942', fillColor: MISSION_COLOR[m.status] || '#F5B942', fillOpacity: 0.7, weight: 2 }}
              >
                <Popup>
                  <div className="text-xs">
                    <p className="font-semibold">{m.drones?.name || m.tipo_servico || 'Missão'}</p>
                    <p>{m.area_label}</p>
                    <p>{fmtDate(m.created_at)} · {m.profiles?.full_name}</p>
                    <p>Estado: {m.status}</p>
                  </div>
                </Popup>
              </CircleMarker>
            ))}

            {showIncidents && filteredIncidents.map((i) => (
              <CircleMarker
                key={`i-${i.id}`}
                center={[i.lat, i.lng]}
                radius={8}
                pathOptions={{ color: INCIDENT_COLOR[i.severity] || '#E64C4C', fillColor: INCIDENT_COLOR[i.severity] || '#E64C4C', fillOpacity: 0.8, weight: 2 }}
              >
                <Popup>
                  <div className="text-xs">
                    <p className="font-semibold">{i.title || i.description}</p>
                    <p>{fmtDate(i.occurred_at)}</p>
                    <p>Gravidade: {i.severity}</p>
                    <Link to={`/incidentes/${i.id}`} className="text-blue-600 underline">Ver detalhe</Link>
                  </div>
                </Popup>
              </CircleMarker>
            ))}

            {showSessions && filteredSessions.map((s) => (
              <CircleMarker
                key={`s-${s.id}`}
                center={[s.start_lat, s.start_lng]}
                radius={6}
                pathOptions={{ color: SESSION_COLOR, fillColor: SESSION_COLOR, fillOpacity: 0.6, weight: 2 }}
              >
                <Popup>
                  <div className="text-xs">
                    <p className="font-semibold">{s.start_location_label || 'Serviço'}</p>
                    <p>{fmtDate(s.started_at)}</p>
                    <Link to={`/sessoes/${s.id}`} className="text-blue-600 underline">Ver sessão</Link>
                  </div>
                </Popup>
              </CircleMarker>
            ))}

            {showDetections && detections.map((d) => (
              <CircleMarker
                key={`d-${d.id}`}
                center={[d.lat, d.lng]}
                radius={7}
                pathOptions={{ color: DETECTION_COLOR[d.classification] || '#F5B942', fillColor: DETECTION_COLOR[d.classification] || '#F5B942', fillOpacity: 0.75, weight: 2 }}
              >
                <Popup>
                  <div className="text-xs">
                    <p className="font-semibold">{d.detection_type || 'Deteção'} · {d.counter_drone_systems?.name || '—'}</p>
                    <p>{fmtDate(d.occurred_at)}</p>
                    <p>{d.location_label}</p>
                    <Link to="/deteccoes" className="text-blue-600 underline">Ver deteções</Link>
                  </div>
                </Popup>
              </CircleMarker>
            ))}

            {showBases && bases.map((b) => (
              <Marker key={`b-${b.id}`} position={[b.lat, b.lng]} icon={baseIcon}>
                <Popup>
                  <div className="text-xs">
                    <p className="font-semibold">{b.name}</p>
                    <p>{b.type === 'ponto_lancamento' ? 'Ponto de Lançamento' : 'Base'}</p>
                    {b.description && <p>{b.description}</p>}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      )}

      <div className="flex items-center gap-4 text-xs text-muted flex-wrap">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-ok inline-block" /> Missão concluída</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-alert inline-block" /> Falhada / incidente</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-cyan inline-block" /> Início de sessão</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber inline-block" /> Deteção</span>
        <span className="ml-auto">
          {filteredMissions.length} missões · {filteredIncidents.length} incidentes · {detections.length} deteções no mapa
        </span>
      </div>
    </div>
  )
}
