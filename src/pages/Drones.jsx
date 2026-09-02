import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Card, Button, Badge, Input, Select, EmptyState } from '../components/ui'

function secondsToHours(s) {
  return (s / 3600).toFixed(1)
}

function daysUntil(dateStr) {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

function MaintenanceTag({ date }) {
  const days = daysUntil(date)
  if (days === null) return null
  if (days < 0) return <p className="mono text-xs text-alert mt-2">Manutenção vencida há {Math.abs(days)}d</p>
  if (days <= 30) return <p className="mono text-xs text-amber mt-2">Manutenção em {days}d</p>
  return null
}

export default function Drones() {
  const { isAdminOrManager } = useAuth()
  const [drones, setDrones] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', model: '', serial_number: '', status: 'operacional' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('drones').select('*').order('created_at', { ascending: false })
    setDrones(data || [])
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
      const { error: err } = await supabase.from('drones').insert(form)
      if (err) throw err
      setForm({ name: '', model: '', serial_number: '', status: 'operacional' })
      setShowForm(false)
      await load()
    } catch (err) {
      setError(err.message.includes('duplicate') ? 'Já existe um drone com esse número de série.' : 'Erro ao criar.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold text-ink">Drones</h1>
        {isAdminOrManager && (
          <Button onClick={() => setShowForm((v) => !v)}>+ Novo drone</Button>
        )}
      </div>

      {showForm && (
        <Card className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Nome / identificador" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            <Input label="Modelo" value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} placeholder="ex: DJI Matrice 350" />
          </div>
          <Input label="Número de série" value={form.serial_number} onChange={(e) => setForm((f) => ({ ...f, serial_number: e.target.value }))} />
          <Select label="Estado" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
            <option value="operacional">Operacional</option>
            <option value="manutencao">Em manutenção</option>
            <option value="inativo">Inativo</option>
          </Select>
          {error && <p className="text-alert text-sm">{error}</p>}
          <div className="flex gap-2">
            <Button onClick={handleCreate} disabled={busy}>Guardar</Button>
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
          </div>
        </Card>
      )}

      {loading ? (
        <p className="text-muted text-sm">A carregar...</p>
      ) : drones.length === 0 ? (
        <EmptyState title="Sem drones registados" hint={isAdminOrManager ? 'Adiciona o primeiro drone da frota.' : undefined} />
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {drones.map((d) => (
            <Link key={d.id} to={`/drones/${d.id}`}>
              <Card className="hover:border-amber/40 transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-ink font-medium">{d.name}</p>
                    <p className="text-muted text-xs">{d.model}</p>
                  </div>
                  <Badge status={d.status}>{d.status}</Badge>
                </div>
                <div className="mt-3 flex items-center justify-between mono text-xs">
                  <span className="text-muted">S/N {d.serial_number}</span>
                  <span className="text-cyan">{secondsToHours(d.total_flight_seconds)}h voo</span>
                </div>
                <MaintenanceTag date={d.next_maintenance_at} />
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
