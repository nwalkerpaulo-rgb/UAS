import { useCallback, useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Card, Badge, Select, EmptyState } from '../components/ui'

const SEVERITY_LABEL = { baixa: 'Baixa', media: 'Média', alta: 'Alta', critica: 'Crítica' }
const STATUS_LABEL = { reportada: 'Reportada', em_investigacao: 'Em investigação', fechada: 'Fechada' }

function fmtDateTime(d) {
  return new Date(d).toLocaleString('pt-PT', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function IncidentDetail() {
  const { id } = useParams()
  const { isAdminOrManager } = useAuth()

  const [incident, setIncident] = useState(null)
  const [reporter, setReporter] = useState(null)
  const [investigator, setInvestigator] = useState(null)
  const [photos, setPhotos] = useState([])
  const [mission, setMission] = useState(null)
  const [detection, setDetection] = useState(null)
  const [participants, setParticipants] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: inc } = await supabase.from('incidents').select('*').eq('id', id).single()
    if (!inc) {
      setIncident(null)
      setLoading(false)
      return
    }
    setIncident(inc)

    const [{ data: rep }, { data: inv }, { data: ph }, { data: allProfiles }] = await Promise.all([
      supabase.from('profiles').select('full_name, email').eq('id', inc.reported_by).single(),
      inc.investigator_id
        ? supabase.from('profiles').select('full_name, email').eq('id', inc.investigator_id).single()
        : Promise.resolve({ data: null }),
      supabase.from('incident_photos').select('*').eq('incident_id', id),
      isAdminOrManager ? supabase.from('profiles').select('id, full_name') : Promise.resolve({ data: [] }),
    ])
    setReporter(rep)
    setInvestigator(inv)
    setPhotos(ph || [])
    setProfiles(allProfiles || [])

    if (inc.mission_id) {
      const { data: m } = await supabase
        .from('missions')
        .select('*, drones(name, model)')
        .eq('id', inc.mission_id)
        .single()
      setMission(m)
    }

    if (inc.session_id) {
      const { data: parts } = await supabase
        .from('session_participants')
        .select('profile_id, role_in_session, profiles(full_name)')
        .eq('session_id', inc.session_id)
      setParticipants(parts || [])
    }

    if (inc.detection_id) {
      const { data: d } = await supabase
        .from('detections')
        .select('*, counter_drone_systems(name)')
        .eq('id', inc.detection_id)
        .single()
      setDetection(d)
    }

    setLoading(false)
  }, [id, isAdminOrManager])

  useEffect(() => { load() }, [load])

  async function updateStatus(status) {
    await supabase.from('incidents').update({ status }).eq('id', id)
    await load()
  }

  async function updateInvestigator(investigatorId) {
    await supabase.from('incidents').update({ investigator_id: investigatorId || null }).eq('id', id)
    await load()
  }

  if (loading) return <p className="text-muted text-sm">A carregar...</p>
  if (!incident) return <EmptyState title="Ocorrência não encontrada" />

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link to="/incidentes" className="text-xs text-muted hover:text-ink">← Ocorrências</Link>
        <div className="flex items-start justify-between flex-wrap gap-3 mt-2">
          <h1 className="font-display text-xl font-semibold text-ink">
            {incident.title || incident.description}
          </h1>
          <div className="flex items-center gap-2">
            <Badge status={incident.severity}>{SEVERITY_LABEL[incident.severity]}</Badge>
            <Badge status={incident.status === 'fechada' ? 'operacional' : incident.status === 'em_investigacao' ? 'manutencao' : 'aberta'}>
              {STATUS_LABEL[incident.status]}
            </Badge>
          </div>
        </div>
      </div>

      {/* Info geral */}
      <Card>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-muted text-xs mb-1">Reportado por</p>
            <p className="text-ink">{reporter?.full_name || '—'}</p>
          </div>
          <div>
            <p className="text-muted text-xs mb-1">Reportado em</p>
            <p className="mono text-ink text-xs">{fmtDateTime(incident.occurred_at)}</p>
          </div>
          <div>
            <p className="text-muted text-xs mb-1">Tipo</p>
            <p className="text-ink capitalize">{SEVERITY_LABEL[incident.severity]}</p>
          </div>
          <div>
            <p className="text-muted text-xs mb-1">Investigador</p>
            {isAdminOrManager ? (
              <Select
                value={incident.investigator_id || ''}
                onChange={(e) => updateInvestigator(e.target.value)}
                className="text-xs py-1"
              >
                <option value="">Por atribuir</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>{p.full_name}</option>
                ))}
              </Select>
            ) : (
              <p className="text-ink">{investigator?.full_name || 'Por atribuir'}</p>
            )}
          </div>
        </div>

        {isAdminOrManager && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-muted text-xs mb-1.5">Estado</p>
            <Select value={incident.status} onChange={(e) => updateStatus(e.target.value)} className="max-w-[220px]">
              <option value="reportada">Reportada</option>
              <option value="em_investigacao">Em investigação</option>
              <option value="fechada">Fechada</option>
            </Select>
          </div>
        )}
      </Card>

      {/* Descrição / medidas */}
      <Card className="space-y-3">
        <div>
          <p className="text-muted text-xs mb-1">Descrição</p>
          <p className="text-ink text-sm">{incident.description}</p>
        </div>
        {incident.actions_taken && (
          <div>
            <p className="text-muted text-xs mb-1">Ações tomadas</p>
            <p className="text-ink text-sm">{incident.actions_taken}</p>
          </div>
        )}
      </Card>

      {/* Localização */}
      {(incident.location_label || incident.lat) && (
        <Card>
          <p className="text-muted text-xs mb-2">Localização</p>
          {incident.location_label && <p className="text-ink text-sm mb-1">{incident.location_label}</p>}
          {incident.lat && (
            <div className="flex items-center justify-between">
              <p className="mono text-xs text-cyan">{incident.lat.toFixed(5)}, {incident.lng.toFixed(5)}</p>
              <a
                href={`https://www.google.com/maps?q=${incident.lat},${incident.lng}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-cyan hover:underline"
              >
                Abrir no mapa →
              </a>
            </div>
          )}
        </Card>
      )}

      {/* Dados de voo do log associado */}
      {mission && (
        <Card>
          <p className="text-muted text-xs mb-3">Dados de voo — {mission.drones?.name || 'drone'}</p>
          {mission.log_status === 'concluido' ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mono text-xs">
              <div>
                <p className="text-muted">Tempo voo</p>
                <p className="text-cyan text-sm">{mission.flight_seconds ? `${Math.round(mission.flight_seconds / 60)}min` : '—'}</p>
              </div>
              <div>
                <p className="text-muted">Distância</p>
                <p className="text-cyan text-sm">{mission.distance_meters ? `${Math.round(mission.distance_meters)}m` : '—'}</p>
              </div>
              <div>
                <p className="text-muted">Altitude máx</p>
                <p className="text-cyan text-sm">{mission.max_altitude_meters ? `${Math.round(mission.max_altitude_meters)}m` : '—'}</p>
              </div>
              <div>
                <p className="text-muted">Velocidade máx</p>
                <p className="text-cyan text-sm">{mission.max_speed_mps ? `${mission.max_speed_mps.toFixed(1)}m/s` : '—'}</p>
              </div>
            </div>
          ) : (
            <p className="text-muted text-xs">
              {mission.log_status === 'pendente' ? 'Log ainda não foi enviado para esta missão.' : 'Log a processar ou com erro — ver detalhe na sessão.'}
            </p>
          )}
          <Link to={`/sessoes/${incident.session_id}`} className="text-xs text-cyan hover:underline mt-3 inline-block">
            Ver sessão completa →
          </Link>
        </Card>
      )}

      {/* Deteção C-UAS associada */}
      {detection && (
        <Card>
          <p className="text-muted text-xs mb-3">Deteção C-UAS associada — {detection.counter_drone_systems?.name || 'sistema desconhecido'}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mono text-xs">
            <div>
              <p className="text-muted">Tipo</p>
              <p className="text-cyan text-sm">{detection.detection_type || '—'}</p>
            </div>
            <div>
              <p className="text-muted">Classificação</p>
              <p className="text-cyan text-sm">{detection.classification.replace('_', ' ')}</p>
            </div>
            <div>
              <p className="text-muted">Distância</p>
              <p className="text-cyan text-sm">{detection.distance_m ? `${detection.distance_m}m` : '—'}</p>
            </div>
            <div>
              <p className="text-muted">Duração</p>
              <p className="text-cyan text-sm">{detection.duration_seconds ? `${detection.duration_seconds}s` : '—'}</p>
            </div>
          </div>
          <Link to="/deteccoes" className="text-xs text-cyan hover:underline mt-3 inline-block">Ver todas as deteções →</Link>
        </Card>
      )}

      {/* Equipa presente na sessão */}
      {participants.length > 0 && (
        <div>
          <p className="text-muted text-xs mb-2">Equipa presente</p>
          <div className="flex flex-wrap gap-2">
            {participants.map((p) => (
              <span key={p.profile_id} className="text-xs bg-panel2 border border-border rounded-full px-3 py-1 text-ink">
                {p.profiles?.full_name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Fotos */}
      {photos.length > 0 && (
        <div>
          <p className="text-muted text-xs mb-2">Fotos</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {photos.map((p) => (
              <img key={p.id} src={p.photo_url} alt="" className="rounded-lg border border-border aspect-square object-cover" />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
