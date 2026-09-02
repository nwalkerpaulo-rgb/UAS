import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase, uploadFile, BUCKETS } from '../lib/supabase'
import { Card, Badge, Button, Input, EmptyState } from '../components/ui'

const COURSE_SUGGESTIONS = ['CPRANT / Curso UAS', 'Curso C-UAS', 'A1', 'A2', 'A3']

function daysUntil(dateStr) {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

function CertRow({ cert, onUploadDiploma, uploading, onRemove }) {
  const days = daysUntil(cert.expires_at)
  let status = 'operacional'
  let label = cert.expires_at ? `Válido até ${new Date(cert.expires_at).toLocaleDateString('pt-PT')}` : 'Sem validade definida'
  if (days !== null && days < 0) {
    status = 'inativo'
    label = `Expirou em ${new Date(cert.expires_at).toLocaleDateString('pt-PT')}`
  } else if (days !== null && days <= 30) {
    status = 'manutencao'
    label = `Expira em ${days}d`
  }
  return (
    <div className="bg-panel2 rounded-lg px-3 py-2">
      <div className="flex items-center justify-between text-sm gap-2">
        <span className="text-ink">{cert.type}{cert.certificate_number ? ` · Nº ${cert.certificate_number}` : ''}</span>
        <div className="flex items-center gap-2 shrink-0">
          <Badge status={status}>{label}</Badge>
          <button className="text-muted hover:text-alert text-xs" onClick={() => onRemove(cert.id)} title="Remover">✕</button>
        </div>
      </div>
      <div className="mt-1.5">
        {cert.document_url ? (
          <a href={cert.document_url} target="_blank" rel="noreferrer" className="text-xs text-cyan hover:underline">
            Ver diploma (PDF) →
          </a>
        ) : uploading === cert.id ? (
          <span className="text-xs text-amber">A enviar...</span>
        ) : (
          <label className="text-xs text-muted hover:text-cyan cursor-pointer">
            + Anexar diploma (PDF)
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onUploadDiploma(cert.id, e.target.files[0])}
            />
          </label>
        )}
      </div>
    </div>
  )
}

export default function PilotDetail() {
  const { id } = useParams()
  const [pilot, setPilot] = useState(null)
  const [certs, setCerts] = useState([])
  const [missions, setMissions] = useState([])
  const [incidents, setIncidents] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [uploadingDiplomaId, setUploadingDiplomaId] = useState(null)
  const [showAddCert, setShowAddCert] = useState(false)
  const [newCert, setNewCert] = useState({ type: '', certificate_number: '', expires_at: '' })
  const [newCertFile, setNewCertFile] = useState(null)
  const [savingCert, setSavingCert] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: p }, { data: c }, { data: m }, { data: inc }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id).single(),
      supabase.from('certifications').select('*').eq('profile_id', id).order('expires_at'),
      supabase.from('missions').select('*, drones(name)').eq('pilot_id', id).order('created_at', { ascending: false }),
      supabase.from('incidents').select('id, severity, status').eq('reported_by', id),
    ])
    setPilot(p)
    setCerts(c || [])
    setMissions(m || [])
    setIncidents(inc || [])
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  async function handlePhotoUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingPhoto(true)
    try {
      const path = `${id}/perfil_${Date.now()}_${file.name}`
      const url = await uploadFile(BUCKETS.PHOTOS, path, file)
      await supabase.from('profiles').update({ photo_url: url }).eq('id', id)
      await load()
    } catch (err) {
      console.error('Erro ao enviar foto:', err)
    } finally {
      setUploadingPhoto(false)
      e.target.value = ''
    }
  }

  async function handleDiplomaUpload(certId, file) {
    setUploadingDiplomaId(certId)
    try {
      const path = `${id}/diploma_${certId}_${file.name}`
      const url = await uploadFile(BUCKETS.DOCUMENTS, path, file)
      await supabase.from('certifications').update({ document_url: url }).eq('id', certId)
      await load()
    } catch (err) {
      console.error('Erro ao enviar diploma:', err)
    } finally {
      setUploadingDiplomaId(null)
    }
  }

  async function handleAddCert() {
    if (!newCert.type.trim()) return
    setSavingCert(true)
    try {
      const { data: created, error } = await supabase
        .from('certifications')
        .insert({
          profile_id: id,
          type: newCert.type.trim(),
          certificate_number: newCert.certificate_number || null,
          expires_at: newCert.expires_at || null,
        })
        .select()
        .single()
      if (error) throw error

      if (newCertFile && created) {
        const path = `${id}/diploma_${created.id}_${newCertFile.name}`
        const url = await uploadFile(BUCKETS.DOCUMENTS, path, newCertFile)
        await supabase.from('certifications').update({ document_url: url }).eq('id', created.id)
      }

      setNewCert({ type: '', certificate_number: '', expires_at: '' })
      setNewCertFile(null)
      setShowAddCert(false)
      await load()
    } catch (err) {
      console.error('Erro ao adicionar habilitação:', err)
    } finally {
      setSavingCert(false)
    }
  }

  async function handleRemoveCert(certId) {
    await supabase.from('certifications').delete().eq('id', certId)
    await load()
  }

  if (loading) return <p className="text-muted text-sm">A carregar...</p>
  if (!pilot) return <EmptyState title="Piloto não encontrado" />

  const flightSeconds = missions.reduce((sum, m) => sum + (m.flight_seconds || 0), 0)
  const last12Months = missions.filter((m) => new Date(m.created_at) > new Date(Date.now() - 365 * 86400000)).length
  const lastFlight = missions[0]?.created_at
  const hasExpiredCert = certs.some((c) => c.expires_at && new Date(c.expires_at) < new Date())

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link to="/pilotos" className="text-xs text-muted hover:text-ink">← Pilotos</Link>
        <div className="flex items-start justify-between flex-wrap gap-3 mt-2">
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              {pilot.photo_url ? (
                <img src={pilot.photo_url} alt="" className="w-16 h-16 rounded-full object-cover border border-border" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-panel2 border border-border flex items-center justify-center text-muted text-xl font-display">
                  {pilot.full_name?.[0] || '?'}
                </div>
              )}
              <label className="absolute -bottom-1 -right-1 bg-panel border border-border rounded-full w-6 h-6 flex items-center justify-center text-xs cursor-pointer hover:border-amber/50">
                {uploadingPhoto ? '…' : '✎'}
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploadingPhoto} />
              </label>
            </div>
            <div>
              <h1 className="font-display text-xl font-semibold text-ink">{pilot.full_name}</h1>
              <p className="text-muted text-sm">
                {pilot.posto ? `${pilot.posto} · ` : ''}{pilot.subunidade || pilot.email}
              </p>
            </div>
          </div>
          <Badge status={hasExpiredCert ? 'inativo' : 'operacional'}>{hasExpiredCert ? 'Habilitação expirada' : 'Apto'}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <p className="mono text-xl text-cyan">{(flightSeconds / 3600).toFixed(1)}h</p>
          <p className="text-muted text-xs mt-1">Horas de voo</p>
        </Card>
        <Card>
          <p className="mono text-xl text-amber">{missions.length}</p>
          <p className="text-muted text-xs mt-1">Missões</p>
        </Card>
        <Card>
          <p className="mono text-xl text-ink">{last12Months}</p>
          <p className="text-muted text-xs mt-1">Últimos 12 meses</p>
        </Card>
        <Card>
          <p className="mono text-xl text-ink">{incidents.length}</p>
          <p className="text-muted text-xs mt-1">Incidentes</p>
        </Card>
      </div>

      {lastFlight && (
        <p className="text-muted text-xs">Último voo: {new Date(lastFlight).toLocaleDateString('pt-PT')}</p>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-muted text-xs">Habilitações</p>
          <button className="text-xs text-amber hover:underline" onClick={() => setShowAddCert((v) => !v)}>
            + Adicionar habilitação
          </button>
        </div>

        {showAddCert && (
          <Card className="mb-3 space-y-3">
            <div>
              <span className="block text-xs text-muted mb-1.5">Nome do curso</span>
              <input
                list="course-suggestions"
                className="focus-ring w-full bg-panel2 border border-border rounded-lg px-3 py-2 text-sm text-ink placeholder:text-muted"
                placeholder="ex: A1, Curso C-UAS, ou outro nome livre"
                value={newCert.type}
                onChange={(e) => setNewCert((c) => ({ ...c, type: e.target.value }))}
              />
              <datalist id="course-suggestions">
                {COURSE_SUGGESTIONS.map((s) => <option key={s} value={s} />)}
              </datalist>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Nº certificado (opcional)" value={newCert.certificate_number} onChange={(e) => setNewCert((c) => ({ ...c, certificate_number: e.target.value }))} />
              <Input label="Validade (opcional)" type="date" value={newCert.expires_at} onChange={(e) => setNewCert((c) => ({ ...c, expires_at: e.target.value }))} />
            </div>
            <div>
              <span className="block text-xs text-muted mb-1.5">Diploma (PDF, opcional)</span>
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setNewCertFile(e.target.files?.[0] || null)}
                className="text-xs text-muted"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAddCert} disabled={savingCert || !newCert.type.trim()}>
                {savingCert ? 'A guardar...' : 'Guardar habilitação'}
              </Button>
              <Button variant="ghost" onClick={() => { setShowAddCert(false); setNewCert({ type: '', certificate_number: '', expires_at: '' }); setNewCertFile(null) }}>
                Cancelar
              </Button>
            </div>
          </Card>
        )}

        {certs.length === 0 ? (
          <p className="text-muted text-xs">Sem habilitações registadas.</p>
        ) : (
          <div className="space-y-1.5">
            {certs.map((c) => (
              <CertRow key={c.id} cert={c} onUploadDiploma={handleDiplomaUpload} uploading={uploadingDiplomaId} onRemove={handleRemoveCert} />
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="text-muted text-xs mb-2">Histórico de missões</p>
        {missions.length === 0 ? (
          <p className="text-muted text-xs">Sem missões registadas.</p>
        ) : (
          <div className="space-y-2">
            {missions.map((m) => (
              <Card key={m.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="text-ink">{m.drones?.name || m.tipo_servico || 'Missão'}</p>
                  <p className="mono text-xs text-muted mt-0.5">
                    {new Date(m.created_at).toLocaleDateString('pt-PT')}
                    {m.area_label ? ` · ${m.area_label}` : ''}
                  </p>
                </div>
                <Badge status={m.status}>{m.status}</Badge>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
