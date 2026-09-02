import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useGeolocation } from '../hooks/useGeolocation'
import { Card, Button, Input, Textarea } from '../components/ui'

export default function SessionStart() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { coords, status, errorMsg, capture } = useGeolocation()

  const [profiles, setProfiles] = useState([])
  const [selectedParticipants, setSelectedParticipants] = useState([])
  const [locationLabel, setLocationLabel] = useState('')
  const [manualLat, setManualLat] = useState('')
  const [manualLng, setManualLng] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    capture()
    supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('active', true)
      .then(({ data }) => setProfiles(data || []))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Quando o GPS obtém coordenadas, preenche os campos editáveis — mas o
  // utilizador pode sempre corrigi-las ou preenchê-las à mão se o GPS falhar.
  useEffect(() => {
    if (coords) {
      setManualLat(coords.lat.toFixed(6))
      setManualLng(coords.lng.toFixed(6))
    }
  }, [coords])

  function toggleParticipant(id) {
    setSelectedParticipants((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    )
  }

  async function handleStart() {
    setBusy(true)
    setError(null)
    try {
      const lat = manualLat !== '' ? Number(manualLat) : null
      const lng = manualLng !== '' ? Number(manualLng) : null

      const { data: newSession, error: sessionError } = await supabase
        .from('service_sessions')
        .insert({
          created_by: user.id,
          status: 'aberta',
          start_lat: Number.isFinite(lat) ? lat : null,
          start_lng: Number.isFinite(lng) ? lng : null,
          start_location_label: locationLabel || null,
          notes: notes || null,
        })
        .select()
        .single()

      if (sessionError) throw sessionError

      const participantsToInsert = [
        { session_id: newSession.id, profile_id: user.id, role_in_session: 'responsável' },
        ...selectedParticipants
          .filter((id) => id !== user.id)
          .map((id) => ({ session_id: newSession.id, profile_id: id, role_in_session: null })),
      ]

      const { error: participantsError } = await supabase
        .from('session_participants')
        .insert(participantsToInsert)

      if (participantsError) throw participantsError

      navigate(`/sessoes/${newSession.id}`)
    } catch (err) {
      console.error('Erro ao iniciar serviço:', err)
      setError(err.message || 'Não foi possível iniciar o serviço. Tenta novamente.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <h1 className="font-display text-xl font-semibold text-ink">Iniciar Serviço</h1>

      <Card className="space-y-4">
        <Input
          label="Local"
          placeholder="ex: Base Norte, Talhão 4"
          value={locationLabel}
          onChange={(e) => setLocationLabel(e.target.value)}
        />

        <div>
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
            <p className="text-amber text-xs mb-2">{errorMsg} Podes preencher as coordenadas à mão, ou avançar sem elas.</p>
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
        </div>

        <div>
          <p className="text-xs text-muted mb-2">Utilizadores/pilotos presentes</p>
          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
            {profiles.map((p) => (
              <label
                key={p.id}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-panel2 border border-border cursor-pointer text-sm"
              >
                <input
                  type="checkbox"
                  checked={p.id === user.id || selectedParticipants.includes(p.id)}
                  disabled={p.id === user.id}
                  onChange={() => toggleParticipant(p.id)}
                  className="accent-amber"
                />
                <span className="text-ink">{p.full_name}</span>
                <span className="mono text-xs text-muted ml-auto">{p.role}</span>
              </label>
            ))}
          </div>
        </div>

        <Textarea
          label="Notas (opcional)"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </Card>

      {error && <p className="text-alert text-sm mono">{error}</p>}

      <Button onClick={handleStart} disabled={busy} className="w-full">
        {busy ? 'A iniciar...' : 'Confirmar início de serviço'}
      </Button>
    </div>
  )
}
