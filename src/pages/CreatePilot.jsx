import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, createPilotAccount, uploadFile, BUCKETS } from '../lib/supabase'
import { Card, Button, Input, Select } from '../components/ui'

const CERT_TYPES = ['CPRANT / Curso UAS', 'Curso C-UAS', 'A1', 'A2', 'A3', 'Outro']

function emptyCert() {
  return { id: crypto.randomUUID(), type: '', certificate_number: '', expires_at: '', file: null }
}

export default function CreatePilot() {
  const navigate = useNavigate()

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    role: 'piloto',
    nm: '',
    posto: '',
    subunidade: '',
    pelotao: '',
    area_funcional: '',
  })
  const [certs, setCerts] = useState([emptyCert()])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null) // { email, password }

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function updateCert(id, field, value) {
    setCerts((list) => list.map((c) => (c.id === id ? { ...c, [field]: value } : c)))
  }

  function addCert() {
    setCerts((list) => [...list, emptyCert()])
  }

  function removeCert(id) {
    setCerts((list) => list.filter((c) => c.id !== id))
  }

  // preenche o email automaticamente no formato gNM@gnr.pt quando o NM é escrito,
  // se o campo de email ainda não tiver sido tocado manualmente
  const [emailTouched, setEmailTouched] = useState(false)
  function handleNmChange(value) {
    update('nm', value)
    if (!emailTouched && value.trim()) {
      update('email', `g${value.trim()}@gnr.pt`)
    }
  }

  async function handleSubmit() {
    setError(null)
    if (!form.full_name.trim() || !form.email.trim()) {
      setError('Nome e email são obrigatórios.')
      return
    }
    setBusy(true)
    try {
      const account = await createPilotAccount(form)

      const validCerts = certs.filter((c) => c.type)
      for (const c of validCerts) {
        const { data: created, error: certErr } = await supabase
          .from('certifications')
          .insert({
            profile_id: account.profile_id,
            type: c.type,
            certificate_number: c.certificate_number || null,
            expires_at: c.expires_at || null,
          })
          .select()
          .single()
        if (certErr) continue

        if (c.file && created) {
          try {
            const path = `${account.profile_id}/diploma_${created.id}_${c.file.name}`
            const url = await uploadFile(BUCKETS.DOCUMENTS, path, c.file)
            await supabase.from('certifications').update({ document_url: url }).eq('id', created.id)
          } catch (fileErr) {
            console.error('Erro ao enviar diploma:', fileErr)
          }
        }
      }

      setResult({ email: account.email, password: account.password })
    } catch (err) {
      console.error('Erro ao criar piloto:', err)
      setError(err.message || 'Não foi possível criar a conta.')
    } finally {
      setBusy(false)
    }
  }

  if (result) {
    return (
      <div className="max-w-lg mx-auto space-y-5">
        <h1 className="font-display text-xl font-semibold text-ink">Conta criada</h1>
        <Card className="space-y-3">
          <p className="text-ink text-sm">{form.full_name} já pode entrar na app com estas credenciais:</p>
          <div className="bg-panel2 rounded-lg p-3 mono text-sm space-y-1">
            <p><span className="text-muted">Email: </span><span className="text-ink">{result.email}</span></p>
            <p><span className="text-muted">Password: </span><span className="text-amber">{result.password}</span></p>
          </div>
          <p className="text-muted text-xs">
            Copia e envia-as por um canal seguro — não voltam a aparecer depois de saíres desta página.
            Recomenda-se que a pessoa mude a password depois do primeiro login.
          </p>
        </Card>
        <div className="flex gap-2">
          <Button onClick={() => { setResult(null); setForm({ full_name: '', email: '', phone: '', role: 'piloto', nm: '', posto: '', subunidade: '', pelotao: '', area_funcional: '' }); setCerts([emptyCert()]); setEmailTouched(false) }}>
            Criar outra conta
          </Button>
          <Button variant="secondary" onClick={() => navigate('/pilotos')}>Ver Pilotos</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="font-display text-xl font-semibold text-ink">Criar Piloto / Utilizador</h1>

      <Card className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Nome completo" value={form.full_name} onChange={(e) => update('full_name', e.target.value)} />
          <Input label="Número mecanográfico (NM)" value={form.nm} onChange={(e) => handleNmChange(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Email de login"
            type="email"
            value={form.email}
            onChange={(e) => { setEmailTouched(true); update('email', e.target.value) }}
          />
          <Input label="Telefone (opcional)" value={form.phone} onChange={(e) => update('phone', e.target.value)} />
        </div>

        <Select label="Função na app" value={form.role} onChange={(e) => update('role', e.target.value)}>
          <option value="piloto">Piloto</option>
          <option value="observador">Observador</option>
          <option value="gestor">Gestor</option>
          <option value="admin">Admin</option>
        </Select>

        <div className="grid grid-cols-3 gap-3">
          <Input label="Posto" value={form.posto} onChange={(e) => update('posto', e.target.value)} />
          <Input label="Subunidade" value={form.subunidade} onChange={(e) => update('subunidade', e.target.value)} />
          <Input label="Pelotão" value={form.pelotao} onChange={(e) => update('pelotao', e.target.value)} />
        </div>

        <Input label="Área funcional (opcional)" value={form.area_funcional} onChange={(e) => update('area_funcional', e.target.value)} />
      </Card>

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-muted text-xs">Habilitações</p>
          <button className="text-xs text-amber hover:underline" onClick={addCert}>+ Adicionar habilitação</button>
        </div>

        <div className="space-y-2">
          {certs.map((c) => (
            <Card key={c.id} className="space-y-3">
              <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
                <div>
                  <span className="block text-xs text-muted mb-1.5">Nome do curso</span>
                  <input
                    list="course-suggestions"
                    className="focus-ring w-full bg-panel2 border border-border rounded-lg px-3 py-2 text-sm text-ink placeholder:text-muted"
                    placeholder="ex: A1, ou outro nome"
                    value={c.type}
                    onChange={(e) => updateCert(c.id, 'type', e.target.value)}
                  />
                </div>
                <Input label="Nº certificado" value={c.certificate_number} onChange={(e) => updateCert(c.id, 'certificate_number', e.target.value)} />
                <Input label="Validade" type="date" value={c.expires_at} onChange={(e) => updateCert(c.id, 'expires_at', e.target.value)} />
                <button className="text-alert text-xs hover:underline pb-2" onClick={() => removeCert(c.id)}>Remover</button>
              </div>
              <div>
                <span className="block text-xs text-muted mb-1.5">Diploma (PDF, opcional)</span>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => updateCert(c.id, 'file', e.target.files?.[0] || null)}
                  className="text-xs text-muted"
                />
                {c.file && <p className="text-cyan text-xs mt-1">{c.file.name}</p>}
              </div>
            </Card>
          ))}
          {certs.length === 0 && <p className="text-muted text-xs">Sem habilitações adicionadas.</p>}
          <datalist id="course-suggestions">
            {CERT_TYPES.map((t) => <option key={t} value={t} />)}
          </datalist>
        </div>
      </div>

      {error && <p className="text-alert text-sm mono">{error}</p>}

      <Button onClick={handleSubmit} disabled={busy} className="w-full">
        {busy ? 'A criar...' : 'Criar conta'}
      </Button>
    </div>
  )
}
