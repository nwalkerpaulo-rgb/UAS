import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useGeolocation } from '../hooks/useGeolocation'
import { Card, Button, Select, Textarea, Input } from '../components/ui'

const DETECTION_TYPES = ['RF', 'Radar', 'Óptico', 'Acústico', 'Outro']

export default function DetectionNew() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { coords, status, capture } = useGeolocation()

  const [systems, setSystems] = useState([])
  const [form, setForm] = useState({
    system_id: '',
    classification: 'nao_identificada',
    detection_type: 'RF',
    azimuth_deg: '',
    distance_m: '',
    duration_seconds: '',
    location_label: '',
    result: '',
    notes: '',
  })
  const [manualLat, setManualLat] = useState('')
  const [manualLng, setManualLng] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    capture()
    supabase.from('counter_drone_systems').select('id, name').then(({ data }) => setSystems(data || []))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (coords) {
      setManualLat(coords.lat.toFixed(6))
      setManualLng(coords.lng.toFixed(6))
    }
  }, [coords])

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit() {
    setError(null)
    setBusy(true)
    try {
      const lat = manualLat !== '' ? Number(manualLat) : null
      const lng = manualLng !== '' ? Number(manualLng) : null

      const { error: err } = await supabase.from('detections').insert({
        operator_id: user.id,
        system_id: form.system_id || null,
        classification: form.classification,
        detection_type: form.detection_type || null,
        azimuth_deg: form.azimuth_deg ? Number(form.azimuth_deg) : null,
        distance_m: form.distance_m ? Number(form.distance_m) : null,
        duration_seconds: form.duration_seconds ? Number(form.duration_seconds) : null,
        location_label: form.location_label || null,
        lat: Number.isFinite(lat) ? lat : null,
        lng: Number.isFinite(lng) ? lng : null,
        result: form.result || null,
        notes: form.notes || null,
      })
      if (err) throw err
      navigate('/deteccoes')
    } catch (err) {
      console.error('Erro ao registar deteção:', err)
      setError(err.message || 'Não foi possível registar a deteção.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <h1 className="font-display text-xl font-semibold text-ink">Registar Deteção</h1>

      <Card className="space-y-4">
        <Select label="Sistema C-UAS" value={form.system_id} onChange={(e) => update('system_id', e.target.value)}>
          <option value="">Não especificado</option>
          {systems.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>

        <Select label="Classificação" value={form.classification} onChange={(e) => update('classification', e.target.value)}>
          <option value="identificada_autorizada">Identificada / Autorizada</option>
          <option value="suspeita">Suspeita</option>
          <option value="nao_identificada">Não identificada</option>
        </Select>

        <Select label="Tipo de deteção" value={form.detection_type} onChange={(e) => update('detection_type', e.target.value)}>
          {DETECTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </Select>

        <div className="grid grid-cols-3 gap-3">
          <Input label="Azimute (°)" type="number" value={form.azimuth_deg} onChange={(e) => update('azimuth_deg', e.target.value)} />
          <Input label="Distância (m)" type="number" value={form.distance_m} onChange={(e) => update('distance_m', e.target.value)} />
          <Input label="Duração (s)" type="number" value={form.duration_seconds} onChange={(e) => update('duration_seconds', e.target.value)} />
        </div>

        <Input label="Local (opcional)" value={form.location_label} onChange={(e) => update('location_label', e.target.value)} />
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-muted">Coordenadas (opcional)</p>
          {status !== 'loading' && (
            <button type="button" className="text-xs text-cyan hover:underline" onClick={capture}>Usar GPS</button>
          )}
        </div>
        {status === 'loading' && <p className="mono text-sm text-cyan">A obter localização...</p>}
        <div className="grid grid-cols-2 gap-3">
          <Input label="Latitude" type="number" step="any" value={manualLat} onChange={(e) => setManualLat(e.target.value)} />
          <Input label="Longitude" type="number" step="any" value={manualLng} onChange={(e) => setManualLng(e.target.value)} />
        </div>
      </Card>

      <Card className="space-y-4">
        <Textarea label="Resultado" rows={2} value={form.result} onChange={(e) => update('result', e.target.value)} placeholder="ex: identificado como operador autorizado, escalado para incidente..." />
        <Textarea label="Notas (opcional)" rows={2} value={form.notes} onChange={(e) => update('notes', e.target.value)} />
      </Card>

      {error && <p className="text-alert text-sm mono">{error}</p>}

      <Button onClick={handleSubmit} disabled={busy} className="w-full">
        {busy ? 'A registar...' : 'Registar deteção'}
      </Button>
    </div>
  )
}
