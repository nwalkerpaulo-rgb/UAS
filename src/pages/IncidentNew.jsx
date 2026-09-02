import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase, uploadFile, BUCKETS } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useGeolocation } from '../hooks/useGeolocation'
import { Card, Button, Select, Textarea, Input } from '../components/ui'

export default function IncidentNew() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('sessao')
  const { coords, status, capture } = useGeolocation()

  const [title, setTitle] = useState('')
  const [locationLabel, setLocationLabel] = useState('')
  const [description, setDescription] = useState('')
  const [severity, setSeverity] = useState('baixa')
  const [actionsTaken, setActionsTaken] = useState('')
  const [photos, setPhotos] = useState([])
  const [missions, setMissions] = useState([])
  const [missionId, setMissionId] = useState('')
  const [detections, setDetections] = useState([])
  const [detectionId, setDetectionId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [manualLat, setManualLat] = useState('')
  const [manualLng, setManualLng] = useState('')

  useEffect(() => {
    capture()
    if (sessionId) {
      supabase
        .from('missions')
        .select('id, drones(name)')
        .eq('session_id', sessionId)
        .then(({ data }) => setMissions(data || []))
    }
    supabase
      .from('detections')
      .select('id, occurred_at, detection_type, counter_drone_systems(name)')
      .order('occurred_at', { ascending: false })
      .limit(20)
      .then(({ data }) => setDetections(data || []))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (coords) {
      setManualLat(coords.lat.toFixed(6))
      setManualLng(coords.lng.toFixed(6))
    }
  }, [coords])

  function handlePhotoSelect(e) {
    const files = Array.from(e.target.files || [])
    setPhotos((prev) => [...prev, ...files])
  }

  async function handleSubmit() {
    if (!description.trim()) {
      setError('Descreve a ocorrência.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const lat = manualLat !== '' ? Number(manualLat) : null
      const lng = manualLng !== '' ? Number(manualLng) : null

      const { data: incident, error: err } = await supabase
        .from('incidents')
        .insert({
          session_id: sessionId || null,
          mission_id: missionId || null,
          detection_id: detectionId || null,
          reported_by: user.id,
          title: title || null,
          location_label: locationLabel || null,
          severity,
          description,
          actions_taken: actionsTaken || null,
          lat: Number.isFinite(lat) ? lat : null,
          lng: Number.isFinite(lng) ? lng : null,
        })
        .select()
        .single()

      if (err) throw err

      for (const file of photos) {
        const path = `${incident.id}/${Date.now()}_${file.name}`
        const url = await uploadFile(BUCKETS.PHOTOS, path, file)
        await supabase.from('incident_photos').insert({ incident_id: incident.id, photo_url: url })
      }

      navigate(`/incidentes/${incident.id}`)
    } catch (err) {
      console.error('Erro ao registar ocorrência:', err)
      setError(err.message || 'Não foi possível registar a ocorrência.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <h1 className="font-display text-xl font-semibold text-ink">Registar Ocorrência</h1>

      <Card>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-muted">Coordenadas (opcional — só para marcar o ponto exato)</p>
          {status !== 'loading' && (
            <button type="button" className="text-xs text-cyan hover:underline" onClick={capture}>
              Usar GPS
            </button>
          )}
        </div>

        {status === 'loading' && <p className="mono text-sm text-cyan">A obter localização...</p>}
        {status === 'error' && (
          <p className="text-amber text-xs mb-2">Localização indisponível. Podes preencher as coordenadas à mão, ou avançar sem elas.</p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Latitude"
            type="number"
            step="any"
            placeholder="ex: 38.722300"
            value={manualLat}
            onChange={(e) => setManualLat(e.target.value)}
          />
          <Input
            label="Longitude"
            type="number"
            step="any"
            placeholder="ex: -9.139300"
            value={manualLng}
            onChange={(e) => setManualLng(e.target.value)}
          />
        </div>
        {coords && status === 'ok' && (
          <p className="mono text-xs text-muted mt-1">GPS: ±{Math.round(coords.accuracy)}m de precisão</p>
        )}
      </Card>

      <Card className="space-y-4">
        <Input
          label="Título (opcional)"
          placeholder="ex: Vento forte quase causou queda"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <Input
          label="Local (opcional)"
          placeholder="ex: Rua dos Pescadores, Faro"
          value={locationLabel}
          onChange={(e) => setLocationLabel(e.target.value)}
        />

        <Select label="Gravidade" value={severity} onChange={(e) => setSeverity(e.target.value)}>
          <option value="baixa">Baixa</option>
          <option value="media">Média</option>
          <option value="alta">Alta</option>
          <option value="critica">Crítica</option>
        </Select>

        {missions.length > 0 && (
          <Select label="Missão associada (opcional)" value={missionId} onChange={(e) => setMissionId(e.target.value)}>
            <option value="">Nenhuma</option>
            {missions.map((m) => (
              <option key={m.id} value={m.id}>{m.drones?.name || 'Missão sem drone'}</option>
            ))}
          </Select>
        )}

        {detections.length > 0 && (
          <Select label="Deteção C-UAS associada (opcional)" value={detectionId} onChange={(e) => setDetectionId(e.target.value)}>
            <option value="">Nenhuma</option>
            {detections.map((d) => (
              <option key={d.id} value={d.id}>
                {new Date(d.occurred_at).toLocaleDateString('pt-PT')} · {d.detection_type || 'Deteção'} · {d.counter_drone_systems?.name || '—'}
              </option>
            ))}
          </Select>
        )}

        <Textarea
          label="Descrição"
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="O que aconteceu?"
          required
        />

        <Textarea
          label="Ações tomadas (opcional)"
          rows={2}
          value={actionsTaken}
          onChange={(e) => setActionsTaken(e.target.value)}
        />

        <div>
          <p className="text-xs text-muted mb-1.5">Fotos (opcional)</p>
          <label className="text-xs text-amber cursor-pointer hover:underline">
            + Adicionar fotos
            <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={handlePhotoSelect} />
          </label>
          {photos.length > 0 && (
            <p className="text-muted text-xs mt-1">{photos.length} foto(s) selecionada(s)</p>
          )}
        </div>
      </Card>

      {error && <p className="text-alert text-sm mono">{error}</p>}

      <Button onClick={handleSubmit} disabled={busy} className="w-full">
        {busy ? 'A registar...' : 'Registar ocorrência'}
      </Button>
    </div>
  )
}
