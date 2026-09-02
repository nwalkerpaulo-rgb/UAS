import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase, uploadFile, uploadPrivateFile, processDjiLog, BUCKETS } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useGeolocation } from '../hooks/useGeolocation'
import { Card, Button, Badge, Input, Select, Textarea, EmptyState } from '../components/ui'

function elapsed(start, end) {
  const s = Math.floor((new Date(end || Date.now()).getTime() - new Date(start).getTime()) / 1000)
  const h = String(Math.floor(s / 3600)).padStart(2, '0')
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  return `${h}h${m}m`
}

export default function SessionDetail() {
  const { id } = useParams()
  const { user, isAdminOrManager } = useAuth()
  const navigate = useNavigate()
  const endGps = useGeolocation()

  const [session, setSession] = useState(null)
  const [participants, setParticipants] = useState([])
  const [photos, setPhotos] = useState([])
  const [missions, setMissions] = useState([])
  const [incidents, setIncidents] = useState([])
  const [drones, setDrones] = useState([])
  const [systems, setSystems] = useState([])
  const [pilots, setPilots] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [showCloseForm, setShowCloseForm] = useState(false)
  const [showMissionForm, setShowMissionForm] = useState(false)
  const [newMission, setNewMission] = useState({
    tipo_servico: 'UAS',
    category: 'Vigilância',
    drone_id: '',
    counter_drone_system_id: '',
    observer_id: '',
    status: 'concluida',
    notes: '',
  })
  const [missionError, setMissionError] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: s }, { data: parts }, { data: ph }, { data: mi }, { data: inc }, { data: dr }, { data: sy }, { data: pl }] = await Promise.all([
      supabase.from('service_sessions').select('*').eq('id', id).single(),
      supabase.from('session_participants').select('profile_id, role_in_session, profiles(full_name)').eq('session_id', id),
      supabase.from('session_photos').select('*').eq('session_id', id).order('taken_at'),
      supabase.from('missions').select('*, drones(name), counter_drone_systems(name)').eq('session_id', id).order('created_at'),
      supabase.from('incidents').select('*').eq('session_id', id).order('occurred_at'),
      supabase.from('drones').select('id, name, model'),
      supabase.from('counter_drone_systems').select('id, name'),
      supabase.from('profiles').select('id, full_name').eq('role', 'piloto').order('full_name'),
    ])
    setSession(s)
    setParticipants(parts || [])
    setPhotos(ph || [])
    setMissions(mi || [])
    setIncidents(inc || [])
    setDrones(dr || [])
    setSystems(sy || [])
    setPilots(pl || [])
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  const isOwner = session?.created_by === user?.id
  const canEdit = isOwner || isAdminOrManager
  const isOpen = session?.status === 'aberta'

  async function handlePhotoUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingPhoto(true)
    try {
      const path = `${id}/${Date.now()}_${file.name}`
      const url = await uploadFile(BUCKETS.PHOTOS, path, file)
      await supabase.from('session_photos').insert({
        session_id: id,
        uploaded_by: user.id,
        photo_url: url,
      })
      await load()
    } catch (err) {
      console.error(err)
    } finally {
      setUploadingPhoto(false)
      e.target.value = ''
    }
  }

  async function handleAddMission() {
    setBusy(true)
    setMissionError(null)
    try {
      const isCuas = newMission.tipo_servico === 'C-UAS'
      const { error } = await supabase.from('missions').insert({
        session_id: id,
        pilot_id: user.id,
        observer_id: newMission.observer_id || null,
        drone_id: isCuas ? null : newMission.drone_id || null,
        counter_drone_system_id: isCuas ? newMission.counter_drone_system_id || null : null,
        tipo_servico: newMission.tipo_servico,
        category: newMission.category,
        status: newMission.status,
        origin: 'manual',
        notes: newMission.notes || null,
        started_at: new Date().toISOString(),
      })
      if (error) throw error
      setNewMission({ tipo_servico: 'UAS', category: 'Vigilância', drone_id: '', counter_drone_system_id: '', observer_id: '', status: 'concluida', notes: '' })
      setShowMissionForm(false)
      await load()
    } catch (err) {
      console.error('Erro ao adicionar missão:', err)
      setMissionError(err.message || 'Não foi possível guardar a missão.')
    } finally {
      setBusy(false)
    }
  }

  const [uploadingLogId, setUploadingLogId] = useState(null)

  async function handleMissionLogUpload(missionId, file) {
    setUploadingLogId(missionId)
    try {
      const path = `${id}/${missionId}_${file.name}`
      await uploadPrivateFile(BUCKETS.LOGS, path, file)
      await supabase
        .from('missions')
        .update({ log_file_url: path, log_status: 'a_processar', log_error: null })
        .eq('id', missionId)
      await load()

      try {
        await processDjiLog(missionId)
      } catch (err) {
        console.error('Erro a processar log:', err)
      }
      await load()
    } catch (err) {
      console.error(err)
    } finally {
      setUploadingLogId(null)
    }
  }

  async function handleCloseSession() {
    setBusy(true)
    try {
      await supabase
        .from('service_sessions')
        .update({
          status: 'fechada',
          ended_at: new Date().toISOString(),
          end_lat: endGps.coords?.lat ?? null,
          end_lng: endGps.coords?.lng ?? null,
        })
        .eq('id', id)
      await load()
      setShowCloseForm(false)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <p className="text-muted text-sm">A carregar...</p>
  if (!session) return <EmptyState title="Sessão não encontrada" />

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold text-ink">
            {session.start_location_label || 'Serviço'}
          </h1>
          <p className="mono text-xs text-muted mt-1">
            {new Date(session.started_at).toLocaleString('pt-PT')} · {elapsed(session.started_at, session.ended_at)}
          </p>
        </div>
        <Badge status={session.status}>{session.status}</Badge>
      </div>

      {session.start_lat && (
        <Card className="flex items-center justify-between text-sm">
          <div>
            <p className="text-muted text-xs mb-1">Início</p>
            <p className="mono text-cyan">{session.start_lat.toFixed(5)}, {session.start_lng.toFixed(5)}</p>
          </div>
          {session.end_lat && (
            <div className="text-right">
              <p className="text-muted text-xs mb-1">Fim</p>
              <p className="mono text-cyan">{session.end_lat.toFixed(5)}, {session.end_lng.toFixed(5)}</p>
            </div>
          )}
        </Card>
      )}

      {/* Participantes */}
      <div>
        <h2 className="font-display font-medium text-ink mb-2 text-sm">Presentes</h2>
        <div className="flex flex-wrap gap-2">
          {participants.map((p) => (
            <span key={p.profile_id} className="text-xs bg-panel2 border border-border rounded-full px-3 py-1 text-ink">
              {p.profiles?.full_name}
            </span>
          ))}
        </div>
      </div>

      {/* Fotos */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-display font-medium text-ink text-sm">Fotos</h2>
          {canEdit && (
            <label className="text-xs text-amber cursor-pointer hover:underline">
              {uploadingPhoto ? 'A enviar...' : '+ Adicionar foto'}
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoUpload} disabled={uploadingPhoto} />
            </label>
          )}
        </div>
        {photos.length === 0 ? (
          <p className="text-muted text-xs">Sem fotos ainda.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {photos.map((p) => (
              <img key={p.id} src={p.photo_url} alt="" className="rounded-lg border border-border aspect-square object-cover" />
            ))}
          </div>
        )}
      </div>

      {/* Missões */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-display font-medium text-ink text-sm">Missões</h2>
          {canEdit && (
            <div className="flex items-center gap-3">
              <Link to={`/missoes/planeamento/nova?sessao=${id}`} className="text-xs text-cyan hover:underline">
                Planeamento completo →
              </Link>
              <button className="text-xs text-amber hover:underline" onClick={() => setShowMissionForm((v) => !v)}>
                + Adicionar missão
              </button>
            </div>
          )}
        </div>

        {showMissionForm && (
          <Card className="mb-3 space-y-3">
            <Select
              label="Tipo de serviço"
              value={newMission.tipo_servico}
              onChange={(e) => setNewMission((m) => ({ ...m, tipo_servico: e.target.value, drone_id: '', counter_drone_system_id: '' }))}
            >
              <option value="UAS">UAS</option>
              <option value="C-UAS">C-UAS</option>
            </Select>

            {newMission.tipo_servico === 'C-UAS' ? (
              <Select
                label="Sistema C-UAS"
                value={newMission.counter_drone_system_id}
                onChange={(e) => setNewMission((m) => ({ ...m, counter_drone_system_id: e.target.value }))}
              >
                <option value="">Não especificado</option>
                {systems.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            ) : (
              <Select
                label="Drone"
                value={newMission.drone_id}
                onChange={(e) => setNewMission((m) => ({ ...m, drone_id: e.target.value }))}
              >
                <option value="">Sem drone (missão não-aérea)</option>
                {drones.map((d) => (
                  <option key={d.id} value={d.id}>{d.name} — {d.model}</option>
                ))}
              </Select>
            )}

            <Select
              label="Observador (opcional)"
              value={newMission.observer_id}
              onChange={(e) => setNewMission((m) => ({ ...m, observer_id: e.target.value }))}
            >
              <option value="">Nenhum</option>
              {pilots.filter((p) => p.id !== user.id).map((p) => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </Select>

            <Select
              label="Estado"
              value={newMission.status}
              onChange={(e) => setNewMission((m) => ({ ...m, status: e.target.value }))}
            >
              <option value="concluida">Concluída</option>
              <option value="falhada">Falhada</option>
              <option value="cua">Cua</option>
            </Select>
            <Textarea
              label="Notas"
              rows={2}
              value={newMission.notes}
              onChange={(e) => setNewMission((m) => ({ ...m, notes: e.target.value }))}
            />
            {missionError && <p className="text-alert text-xs mono">{missionError}</p>}
            <div className="flex gap-2">
              <Button onClick={handleAddMission} disabled={busy}>Guardar missão</Button>
              <Button variant="ghost" onClick={() => setShowMissionForm(false)}>Cancelar</Button>
            </div>
          </Card>
        )}

        {missions.length === 0 ? (
          <p className="text-muted text-xs">Sem missões registadas nesta sessão.</p>
        ) : (
          <div className="space-y-2">
            {missions.map((m) => (
              <Card key={m.id} className="text-sm">
                <div className="flex items-center justify-between">
                  <p className="text-ink">{m.drones?.name || m.counter_drone_systems?.name || 'Sem equipamento associado'}</p>
                  <Badge status={m.status}>{m.status}</Badge>
                </div>
                {m.notes && <p className="text-muted text-xs mt-1">{m.notes}</p>}

                {m.log_status === 'concluido' && (
                  <div className="mt-2 grid grid-cols-3 gap-2 mono text-xs">
                    <div>
                      <p className="text-muted">Tempo voo</p>
                      <p className="text-cyan">{m.flight_seconds ? `${Math.round(m.flight_seconds / 60)}min` : '—'}</p>
                    </div>
                    <div>
                      <p className="text-muted">Distância</p>
                      <p className="text-cyan">{m.distance_meters ? `${Math.round(m.distance_meters)}m` : '—'}</p>
                    </div>
                    <div>
                      <p className="text-muted">Alt. máx</p>
                      <p className="text-cyan">{m.max_altitude_meters ? `${Math.round(m.max_altitude_meters)}m` : '—'}</p>
                    </div>
                  </div>
                )}

                <div className="mt-2">
                  {uploadingLogId === m.id ? (
                    <span className="mono text-xs text-amber">A enviar log...</span>
                  ) : m.log_status === 'a_processar' ? (
                    <span className="mono text-xs text-amber">A decifrar log...</span>
                  ) : m.log_status === 'concluido' ? (
                    <span className="mono text-xs text-ok">✓ Log processado</span>
                  ) : m.log_status === 'erro' ? (
                    <div>
                      <span className="mono text-xs text-alert">Erro ao processar: {m.log_error}</span>
                      {m.drone_id && (
                        <label className="block text-xs text-cyan cursor-pointer hover:underline mt-1">
                          Tentar novamente
                          <input
                            type="file"
                            accept=".dat,.DAT,.txt"
                            className="hidden"
                            onChange={(e) => e.target.files?.[0] && handleMissionLogUpload(m.id, e.target.files[0])}
                          />
                        </label>
                      )}
                    </div>
                  ) : m.drone_id ? (
                    <label className="text-xs text-cyan cursor-pointer hover:underline">
                      Fazer upload do log de voo (.DAT / .txt)
                      <input
                        type="file"
                        accept=".dat,.DAT,.txt"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && handleMissionLogUpload(m.id, e.target.files[0])}
                      />
                    </label>
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Ocorrências */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-display font-medium text-ink text-sm">Ocorrências</h2>
          <Link to={`/incidentes/nova?sessao=${id}`} className="text-xs text-amber hover:underline">
            + Registar ocorrência
          </Link>
        </div>
        {incidents.length === 0 ? (
          <p className="text-muted text-xs">Sem ocorrências registadas.</p>
        ) : (
          <div className="space-y-2">
            {incidents.map((inc) => (
              <Link key={inc.id} to={`/incidentes/${inc.id}`}>
                <Card className="text-sm hover:border-amber/40 transition-colors">
                  <div className="flex items-center justify-between">
                    <p className="text-ink">{inc.title || inc.description}</p>
                    <Badge status={inc.severity}>{inc.severity}</Badge>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Fechar serviço */}
      {isOpen && canEdit && (
        <Card>
          {!showCloseForm ? (
            <Button onClick={() => { setShowCloseForm(true); endGps.capture() }} className="w-full">
              Fechar Serviço
            </Button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-ink">Confirmar fecho do serviço?</p>
              {endGps.status === 'loading' && <p className="mono text-xs text-cyan">A obter localização final...</p>}
              {endGps.status === 'ok' && (
                <p className="mono text-xs text-cyan">
                  {endGps.coords.lat.toFixed(5)}, {endGps.coords.lng.toFixed(5)}
                </p>
              )}
              {missions.some((m) => m.drone_id && m.log_status !== 'concluido') && (
                <p className="text-amber text-xs">
                  Há missões com drone sem log importado. Podes fazer o upload mais tarde — a sessão fica "fechada" até o log ser processado.
                </p>
              )}
              <div className="flex gap-2">
                <Button onClick={handleCloseSession} disabled={busy}>
                  {busy ? 'A fechar...' : 'Confirmar'}
                </Button>
                <Button variant="ghost" onClick={() => setShowCloseForm(false)}>Cancelar</Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
