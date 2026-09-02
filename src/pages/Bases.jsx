import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useGeolocation } from '../hooks/useGeolocation'
import { Card, Button, Badge, Input, Select, Textarea, EmptyState } from '../components/ui'

const TYPE_LABEL = { base: 'Base', ponto_lancamento: 'Ponto de Lançamento' }

export default function Bases() {
  const { isAdminOrManager } = useAuth()
  const { coords, status, capture } = useGeolocation()

  const [bases, setBases] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', type: 'base', lat: '', lng: '', description: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('bases').select('*').order('name')
    setBases(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (coords) {
      setForm((f) => ({ ...f, lat: coords.lat.toFixed(6), lng: coords.lng.toFixed(6) }))
    }
  }, [coords])

  async function handleCreate() {
    setError(null)
    if (!form.name.trim() || form.lat === '' || form.lng === '') {
      setError('Preenche nome e coordenadas.')
      return
    }
    setBusy(true)
    try {
      const { error: err } = await supabase.from('bases').insert({
        name: form.name.trim(),
        type: form.type,
        lat: Number(form.lat),
        lng: Number(form.lng),
        description: form.description || null,
      })
      if (err) throw err
      setForm({ name: '', type: 'base', lat: '', lng: '', description: '' })
      setShowForm(false)
      await load()
    } catch (err) {
      setError(err.message || 'Erro ao criar.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(id) {
    await supabase.from('bases').delete().eq('id', id)
    await load()
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold text-ink">Bases / Pontos de Lançamento</h1>
        {isAdminOrManager && <Button onClick={() => setShowForm((v) => !v)}>+ Nova base</Button>}
      </div>

      {showForm && (
        <Card className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Nome" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="ex: Base Norte" />
            <Select label="Tipo" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
              <option value="base">Base</option>
              <option value="ponto_lancamento">Ponto de Lançamento</option>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted">Coordenadas</p>
            <button type="button" className="text-xs text-cyan hover:underline" onClick={capture}>
              {status === 'loading' ? 'A obter...' : 'Usar GPS'}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Latitude" type="number" step="any" value={form.lat} onChange={(e) => setForm((f) => ({ ...f, lat: e.target.value }))} />
            <Input label="Longitude" type="number" step="any" value={form.lng} onChange={(e) => setForm((f) => ({ ...f, lng: e.target.value }))} />
          </div>

          <Textarea label="Descrição (opcional)" rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />

          {error && <p className="text-alert text-sm">{error}</p>}
          <div className="flex gap-2">
            <Button onClick={handleCreate} disabled={busy}>Guardar</Button>
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
          </div>
        </Card>
      )}

      {loading ? (
        <p className="text-muted text-sm">A carregar...</p>
      ) : bases.length === 0 ? (
        <EmptyState title="Sem bases registadas" />
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {bases.map((b) => (
            <Card key={b.id}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-ink font-medium">{b.name}</p>
                  <p className="mono text-xs text-cyan mt-1">{b.lat.toFixed(5)}, {b.lng.toFixed(5)}</p>
                </div>
                <Badge status="operacional">{TYPE_LABEL[b.type]}</Badge>
              </div>
              {b.description && <p className="text-muted text-xs mt-2">{b.description}</p>}
              {isAdminOrManager && (
                <button className="text-alert text-xs hover:underline mt-2" onClick={() => handleDelete(b.id)}>Remover</button>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
