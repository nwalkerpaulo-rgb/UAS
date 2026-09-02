import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Card, Button, Badge, Input, Select, EmptyState } from '../components/ui'

export default function CounterDrone() {
  const { isAdminOrManager } = useAuth()
  const [systems, setSystems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', model: '', serial_number: '', system_type: '', status: 'operacional' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('counter_drone_systems').select('*').order('created_at', { ascending: false })
    setSystems(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleCreate() {
    setError(null)
    if (!form.name || !form.model || !form.serial_number) {
      setError('Preenche nome, modelo e número de série.')
      return
    }
    setBusy(true)
    try {
      const { error: err } = await supabase.from('counter_drone_systems').insert(form)
      if (err) throw err
      setForm({ name: '', model: '', serial_number: '', system_type: '', status: 'operacional' })
      setShowForm(false)
      await load()
    } catch (err) {
      setError(err.message.includes('duplicate') ? 'Já existe um sistema com esse número de série.' : 'Erro ao criar.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold text-ink">Contra-Drone</h1>
        {isAdminOrManager && <Button onClick={() => setShowForm((v) => !v)}>+ Novo sistema</Button>}
      </div>

      {showForm && (
        <Card className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Nome / identificador" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            <Input label="Modelo" value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Número de série" value={form.serial_number} onChange={(e) => setForm((f) => ({ ...f, serial_number: e.target.value }))} />
            <Select label="Tipo de sistema" value={form.system_type} onChange={(e) => setForm((f) => ({ ...f, system_type: e.target.value }))}>
              <option value="">—</option>
              <option value="RF Detection">Deteção RF</option>
              <option value="Radar">Radar</option>
              <option value="Jamming">Jamming</option>
              <option value="Optico">Ótico</option>
            </Select>
          </div>
          {error && <p className="text-alert text-sm">{error}</p>}
          <div className="flex gap-2">
            <Button onClick={handleCreate} disabled={busy}>Guardar</Button>
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
          </div>
        </Card>
      )}

      {loading ? (
        <p className="text-muted text-sm">A carregar...</p>
      ) : systems.length === 0 ? (
        <EmptyState title="Sem sistemas contra-drone registados" />
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {systems.map((s) => (
            <Link key={s.id} to={`/contra-drone/${s.id}`}>
              <Card className="hover:border-amber/40 transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-ink font-medium">{s.name}</p>
                    <p className="text-muted text-xs">{s.model} {s.system_type && `· ${s.system_type}`}</p>
                  </div>
                  <Badge status={s.status}>{s.status}</Badge>
                </div>
                <p className="mono text-xs text-muted mt-3">S/N {s.serial_number}</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
