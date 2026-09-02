import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useGeolocation } from '../hooks/useGeolocation'
import { geocodeLocation, fetchCurrentWeather } from '../lib/weather'
import { useAppSettings } from '../hooks/useAppSettings'
import { Card, Button, Input, Select, Textarea } from '../components/ui'

const MISSION_TYPES = [
  'Vigilância', 'Reconhecimento', 'Segurança', 'Busca', 'Apoio a Operação',
  'Incidente', 'C-UAS', 'Formação', 'Teste', 'Outro',
]

function CheckRow({ ok, label, manual, onToggle }) {
  return (
    <div className="flex items-center justify-between bg-panel2 rounded-lg px-3 py-2">
      <span className="text-sm text-ink">{label}</span>
      {manual ? (
        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
          <input type="checkbox" className="accent-amber" checked={ok} onChange={onToggle} />
          <span className={ok ? 'text-ok' : 'text-muted'}>{ok ? 'Confirmado' : 'Por confirmar'}</span>
        </label>
      ) : (
        <span className={`text-xs mono ${ok ? 'text-ok' : 'text-alert'}`}>{ok ? '✓ OK' : '✗ Falha'}</span>
      )}
    </div>
  )
}

export default function MissionPlanNew() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('sessao')
  const { settings } = useAppSettings()

  const [form, setForm] = useState({
    category: 'Vigilância',
    scheduled_at: '',
    area_label: '',
    tipo_servico: 'UAS',
    drone_id: '',
    counter_drone_system_id: '',
    pilot_id: '',
    observer_id: '',
    payload: '',
    objective: '',
    expected_duration_min: '',
    risk_level: 'baixo',
  })

  const [drones, setDrones] = useState([])
  const [systems, setSystems] = useState([])
  const [pilots, setPilots] = useState([])
  const [batteries, setBatteries] = useState([])
  const [weather, setWeather] = useState(null)
  const [weatherStatus, setWeatherStatus] = useState('idle') // idle | loading | ok | error
  const [weatherError, setWeatherError] = useState(null)
  const [planCoords, setPlanCoords] = useState(null) // { lat, lng } usadas na meteo
  const gps = useGeolocation()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const isCuas = form.tipo_servico === 'C-UAS'

  const [manualChecks, setManualChecks] = useState({ area: false, docs: false })

  useEffect(() => {
    Promise.all([
      supabase.from('drones').select('*'),
      supabase.from('counter_drone_systems').select('*'),
      supabase.from('profiles').select('id, full_name').eq('role', 'piloto').order('full_name'),
      supabase.from('batteries').select('*'),
    ]).then(([{ data: d }, { data: s }, { data: p }, { data: b }]) => {
      setDrones(d || [])
      setSystems(s || [])
      setPilots(p || [])
      setBatteries(b || [])
    })
  }, [])

  const selectedDrone = drones.find((d) => d.id === form.drone_id)
  const selectedSystem = systems.find((s) => s.id === form.counter_drone_system_id)
  const [pilotCertOk, setPilotCertOk] = useState(null)

  useEffect(() => {
    if (!form.pilot_id) {
      setPilotCertOk(null)
      return
    }
    supabase
      .from('certifications')
      .select('expires_at')
      .eq('profile_id', form.pilot_id)
      .then(({ data }) => {
        if (!data || data.length === 0) {
          setPilotCertOk(false)
          return
        }
        const hasValid = data.some((c) => !c.expires_at || new Date(c.expires_at) >= new Date())
        setPilotCertOk(hasValid)
      })
  }, [form.pilot_id])

  const droneOk = isCuas
    ? (selectedSystem ? selectedSystem.status === 'operacional' : null)
    : (selectedDrone ? selectedDrone.status === 'operacional' : null)

  const maintenanceOk = isCuas
    ? (selectedSystem ? !selectedSystem.next_maintenance_at || new Date(selectedSystem.next_maintenance_at) > new Date() : null)
    : (selectedDrone ? !selectedDrone.next_maintenance_at || new Date(selectedDrone.next_maintenance_at) > new Date() : null)

  const batteryAvailable = isCuas
    ? (form.counter_drone_system_id
        ? batteries.some((b) => b.counter_drone_system_id === form.counter_drone_system_id && b.status === 'operacional')
        : batteries.some((b) => b.status === 'operacional'))
    : (form.drone_id
        ? batteries.some((b) => b.drone_id === form.drone_id && b.status === 'operacional')
        : batteries.some((b) => b.status === 'operacional'))

  const equipmentChosen = isCuas ? !!form.counter_drone_system_id : !!form.drone_id
  const allAutoChecksKnown = form.pilot_id && equipmentChosen
  const allOk =
    allAutoChecksKnown &&
    pilotCertOk &&
    droneOk &&
    maintenanceOk &&
    batteryAvailable &&
    manualChecks.area &&
    manualChecks.docs

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleFetchWeatherFromGps() {
    setWeatherStatus('loading')
    setWeatherError(null)
    gps.capture()
  }

  useEffect(() => {
    if (gps.status === 'ok' && gps.coords && weatherStatus === 'loading') {
      const { lat, lng } = gps.coords
      setPlanCoords({ lat, lng })
      fetchCurrentWeather(lat, lng)
        .then((w) => {
          setWeather(w)
          setWeatherStatus('ok')
        })
        .catch((err) => {
          setWeatherError(err.message)
          setWeatherStatus('error')
        })
    }
    if (gps.status === 'error' && weatherStatus === 'loading') {
      setWeatherError(gps.errorMsg)
      setWeatherStatus('error')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gps.status])

  async function handleFetchWeatherFromLocation() {
    if (!form.area_label.trim()) {
      setWeatherError('Escreve primeiro o local.')
      setWeatherStatus('error')
      return
    }
    setWeatherStatus('loading')
    setWeatherError(null)
    try {
      const place = await geocodeLocation(form.area_label)
      if (!place) {
        setWeatherError(`Não encontrei "${form.area_label}" — tenta um nome mais específico ou usa o GPS.`)
        setWeatherStatus('error')
        return
      }
      setPlanCoords({ lat: place.lat, lng: place.lng })
      const w = await fetchCurrentWeather(place.lat, place.lng)
      setWeather(w)
      setWeatherStatus('ok')
    } catch (err) {
      setWeatherError(err.message)
      setWeatherStatus('error')
    }
  }

  async function handleSubmit() {
    setError(null)
    if (!form.pilot_id || !equipmentChosen || !form.area_label) {
      setError(`Preenche pelo menos piloto, ${isCuas ? 'sistema C-UAS' : 'drone'} e local.`)
      return
    }
    setBusy(true)
    try {
      const { data: mission, error: err } = await supabase
        .from('missions')
        .insert({
          pilot_id: form.pilot_id,
          session_id: sessionId || null,
          drone_id: isCuas ? null : form.drone_id,
          counter_drone_system_id: isCuas ? form.counter_drone_system_id : null,
          observer_id: form.observer_id || null,
          origin: 'manual',
          status: 'concluida', // resultado só se sabe depois — placeholder até à execução
          planning_status: allOk ? 'pronta' : 'planeada',
          scheduled_at: form.scheduled_at || null,
          category: form.category,
          tipo_servico: form.tipo_servico,
          area_label: form.area_label,
          objective: form.objective || null,
          payload: form.payload || null,
          expected_duration_min: form.expected_duration_min ? Number(form.expected_duration_min) : null,
          risk_level: form.risk_level,
          checklist_pilot_ok: !!pilotCertOk,
          checklist_drone_ok: !!droneOk,
          checklist_battery_ok: !!batteryAvailable,
          checklist_maintenance_ok: !!maintenanceOk,
          checklist_area_ok: manualChecks.area,
          checklist_docs_ok: manualChecks.docs,
          weather_snapshot: weather || null,
          plan_lat: planCoords?.lat ?? null,
          plan_lng: planCoords?.lng ?? null,
        })
        .select()
        .single()

      if (err) throw err
      navigate(sessionId ? `/sessoes/${sessionId}` : '/missoes/planeamento')
    } catch (err) {
      console.error('Erro ao criar planeamento:', err)
      setError(err.message || 'Não foi possível criar o planeamento.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {sessionId && (
        <Link to={`/sessoes/${sessionId}`} className="text-xs text-muted hover:text-ink block">← Voltar à sessão</Link>
      )}
      <h1 className="font-display text-xl font-semibold text-ink">
        Nova Missão — Planeamento{sessionId ? ' (dentro do serviço)' : ''}
      </h1>

      <Card className="space-y-4">
        <Select label="Tipo" value={form.category} onChange={(e) => update('category', e.target.value)}>
          {MISSION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </Select>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Data / hora prevista" type="datetime-local" value={form.scheduled_at} onChange={(e) => update('scheduled_at', e.target.value)} />
          <Select label="Serviço" value={form.tipo_servico} onChange={(e) => update('tipo_servico', e.target.value)}>
            <option value="UAS">UAS</option>
            <option value="C-UAS">C-UAS</option>
          </Select>
        </div>

        <Input label="Local" value={form.area_label} onChange={(e) => update('area_label', e.target.value)} placeholder="ex: Base Norte, Talhão 4" />

        <div className="grid grid-cols-2 gap-3">
          {isCuas ? (
            <Select label="Sistema C-UAS" value={form.counter_drone_system_id} onChange={(e) => update('counter_drone_system_id', e.target.value)}>
              <option value="">Escolhe...</option>
              {systems.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          ) : (
            <Select label="Drone" value={form.drone_id} onChange={(e) => update('drone_id', e.target.value)}>
              <option value="">Escolhe...</option>
              {drones.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          )}
          <Select label="Piloto" value={form.pilot_id} onChange={(e) => update('pilot_id', e.target.value)}>
            <option value="">Escolhe...</option>
            {pilots.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </Select>
        </div>

        <Select label="Observador (opcional)" value={form.observer_id} onChange={(e) => update('observer_id', e.target.value)}>
          <option value="">Nenhum</option>
          {pilots.filter((p) => p.id !== form.pilot_id).map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
        </Select>

        <Input label="Payload (opcional)" value={form.payload} onChange={(e) => update('payload', e.target.value)} placeholder="ex: câmara térmica" />

        <Textarea label="Objetivo" rows={2} value={form.objective} onChange={(e) => update('objective', e.target.value)} />

        <div className="grid grid-cols-2 gap-3">
          <Input label="Duração prevista (min)" type="number" value={form.expected_duration_min} onChange={(e) => update('expected_duration_min', e.target.value)} />
          <Select label="Risco" value={form.risk_level} onChange={(e) => update('risk_level', e.target.value)}>
            <option value="baixo">Baixo</option>
            <option value="medio">Médio</option>
            <option value="alto">Alto</option>
          </Select>
        </div>
      </Card>

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-muted text-xs">Meteorologia</p>
          <div className="flex items-center gap-3">
            <button type="button" className="text-xs text-cyan hover:underline" onClick={handleFetchWeatherFromLocation}>
              Obter pelo local
            </button>
            <button type="button" className="text-xs text-cyan hover:underline" onClick={handleFetchWeatherFromGps}>
              Obter pelo GPS
            </button>
          </div>
        </div>

        {weatherStatus === 'loading' && <p className="mono text-sm text-cyan">A obter meteorologia...</p>}
        {weatherStatus === 'error' && <p className="text-amber text-xs">{weatherError}</p>}

        {weatherStatus === 'ok' && weather && (
          <Card>
            <div className="flex items-center justify-between mb-3">
              <p className="text-ink text-sm">{weather.weather_label}</p>
              <p className="mono text-2xl text-amber">{Math.round(weather.temperature_c)}°C</p>
            </div>
            <div className="grid grid-cols-3 gap-3 mono text-xs">
              <div>
                <p className="text-muted">Vento</p>
                <p className="text-cyan">{weather.wind_speed_ms.toFixed(1)} m/s</p>
              </div>
              <div>
                <p className="text-muted">Rajada</p>
                <p className="text-cyan">{weather.wind_gusts_ms.toFixed(1)} m/s</p>
              </div>
              <div>
                <p className="text-muted">Nuvens</p>
                <p className="text-cyan">{weather.cloud_cover_pct}%</p>
              </div>
              <div>
                <p className="text-muted">Humidade</p>
                <p className="text-cyan">{weather.humidity_pct}%</p>
              </div>
              <div>
                <p className="text-muted">Pressão</p>
                <p className="text-cyan">{Math.round(weather.pressure_hpa)} hPa</p>
              </div>
              <div>
                <p className="text-muted">Precipitação</p>
                <p className="text-cyan">{weather.precipitation_mm} mm</p>
              </div>
            </div>
            {weather.wind_gusts_ms >= settings.wind_gust_limit_ms && (
              <p className="text-amber text-xs mt-3">⚠ Rajadas fortes — confirma os limites operacionais do drone.</p>
            )}
            <p className="text-muted text-[10px] mt-3">
              Fonte: Open-Meteo · não inclui índice KP nem visibilidade — confirma esses dados noutra fonte se forem críticos para a missão.
            </p>
          </Card>
        )}
      </div>

      <div>
        <p className="text-muted text-xs mb-2">CHECK OPERACIONAL</p>
        <div className="space-y-1.5">
          <CheckRow ok={!!pilotCertOk} label="Piloto com habilitação válida" />
          <CheckRow ok={!!droneOk} label={isCuas ? 'Sistema C-UAS operacional' : 'Drone operacional'} />
          <CheckRow ok={!!batteryAvailable} label="Bateria disponível" />
          <CheckRow ok={!!maintenanceOk} label="Manutenção em dia" />
          <CheckRow
            ok={manualChecks.area}
            label="Área verificada"
            manual
            onToggle={() => setManualChecks((m) => ({ ...m, area: !m.area }))}
          />
          <CheckRow
            ok={manualChecks.docs}
            label="Documentação válida"
            manual
            onToggle={() => setManualChecks((m) => ({ ...m, docs: !m.docs }))}
          />
        </div>
      </div>

      <Card className={allOk ? 'border-ok/40 bg-ok/5' : 'border-amber/40 bg-amber/5'}>
        <p className={`text-sm font-medium ${allOk ? 'text-ok' : 'text-amber'}`}>
          {allOk ? '✓ MISSÃO PRONTA' : 'Ainda há verificações por confirmar — pode ser guardada como planeada.'}
        </p>
      </Card>

      {error && <p className="text-alert text-sm mono">{error}</p>}

      <Button onClick={handleSubmit} disabled={busy} className="w-full">
        {busy ? 'A guardar...' : allOk ? 'Confirmar planeamento — Missão Pronta' : 'Guardar como planeada'}
      </Button>
    </div>
  )
}
