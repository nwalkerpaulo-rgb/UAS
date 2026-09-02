import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Card, Button, Badge, Input, Select, EmptyState } from '../components/ui'

function secondsToHours(s) {
  return (s / 3600).toFixed(1)
}

export default function Batteries() {
  const { isAdminOrManager } = useAuth()
  const [batteries, setBatteries] = useState([])
  const [drones, setDrones] = useState([])
  const [systems, setSystems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ model: '', serial_number: '', owner: 'drone', drone_id: '', counter_drone_system_id: '', cycle_count: 0 })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function load() {
    setLoading(true)
    const [{ data: b }, { data: d }, { data: s }] = await Promise.all([
      supabase.from('batteries').select('*, drones(name), counter_drone_systems(name)').order('created_at', { ascending: false }),
      supabase.from('drones').select('id, name'),
      supabase.from('counter_drone_systems').select('id, name'),
    ])
    setBatteries(b || [])
    setDrones(d || [])
    setSystems(s || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleCreate() {
    setError(null)
    if (!form.model || !form.serial_number) {
      setError('Preenche modelo e número de série.')
      return
    }
    setBusy(true)
    try {
      const { error: err } = await supabase.from('batteries').insert({
        model: form.model,
        serial_number: form.serial_number,
        drone_id: form.owner === 'drone' ? form.drone_id || null : null,
        counter_drone_system_id: form.owner === 'cuas' ? form.counter_drone_system_id || null : null,
        cycle_count: Number(form.cycle_count) || 0,
      })
      if (err) throw err
      setForm({ model: '', serial_number: '', owner: 'drone', drone_id: '', counter_drone_system_id: '', cycle_count: 0 })
      setShowForm(false)
      await load()
    } catch (err) {
      setError(err.message.includes('duplicate') ? 'Já existe uma bateria com esse número de série.' : 'Erro ao criar.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold text-ink">Baterias</h1>
        {isAdminOrManager && <Button onClick={() => setShowForm((v) => !v)}>+ Nova bateria</Button>}
      </div>

      {showForm && (
        <Card className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Modelo" value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} placeholder="ex: TB65" />
            <Input label="Número de série" value={form.serial_number} onChange={(e) => setForm((f) => ({ ...f, serial_number: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Pertence a" value={form.owner} onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))}>
              <option value="drone">Drone</option>
              <option value="cuas">Sistema C-UAS</option>
              <option value="none">Nenhum (sobresselente)</option>
            </Select>
            <Input label="Ciclos iniciais" type="number" min="0" value={form.cycle_count} onChange={(e) => setForm((f) => ({ ...f, cycle_count: e.target.value }))} />
          </div>
          {form.owner === 'drone' && (
            <Select label="Drone associado" value={form.drone_id} onChange={(e) => setForm((f) => ({ ...f, drone_id: e.target.value }))}>
              <option value="">Escolhe...</option>
              {drones.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          )}
          {form.owner === 'cuas' && (
            <Select label="Sistema C-UAS associado" value={form.counter_drone_system_id} onChange={(e) => setForm((f) => ({ ...f, counter_drone_system_id: e.target.value }))}>
              <option value="">Escolhe...</option>
              {systems.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          )}
          {error && <p className="text-alert text-sm">{error}</p>}
          <div className="flex gap-2">
            <Button onClick={handleCreate} disabled={busy}>Guardar</Button>
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
          </div>
        </Card>
      )}

      {loading ? (
        <p className="text-muted text-sm">A carregar...</p>
      ) : batteries.length === 0 ? (
        <EmptyState title="Sem baterias registadas" />
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {batteries.map((b) => (
            <Link key={b.id} to={`/baterias/${b.id}`}>
              <Card className="hover:border-amber/40 transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-ink font-medium">{b.model}</p>
                    <p className="text-muted text-xs">{b.drones?.name || b.counter_drone_systems?.name || 'Sem equipamento fixo'}</p>
                  </div>
                  <Badge status={b.status}>{b.status}</Badge>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 mono text-xs">
                  <div>
                    <p className="text-muted">S/N</p>
                    <p className="text-ink">{b.serial_number}</p>
                  </div>
                  <div>
                    <p className="text-muted">Ciclos</p>
                    <p className="text-amber">{b.cycle_count}</p>
                  </div>
                  <div>
                    <p className="text-muted">Horas voo</p>
                    <p className="text-cyan">{secondsToHours(b.total_flight_seconds)}h</p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
