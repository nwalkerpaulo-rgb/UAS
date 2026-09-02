import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Card, Button, Badge, Input, Select, EmptyState } from '../components/ui'

export default function Equipment() {
  const { isAdminOrManager, user, profile } = useAuth()
  const [items, setItems] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', type: '', serial_number: '' })
  const [busy, setBusy] = useState(false)

  async function load() {
    setLoading(true)
    const [{ data: e }, { data: p }] = await Promise.all([
      supabase.from('equipment').select('*, profiles!equipment_checked_out_by_fkey(full_name)').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, full_name'),
    ])
    setItems(e || [])
    setProfiles(p || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleCreate() {
    if (!form.name || !form.type) return
    setBusy(true)
    try {
      await supabase.from('equipment').insert(form)
      setForm({ name: '', type: '', serial_number: '' })
      setShowForm(false)
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function handleCheckOut(item) {
    await supabase.from('equipment').update({ checked_out_by: user.id, checked_out_at: new Date().toISOString() }).eq('id', item.id)
    await load()
  }

  async function handleCheckIn(item) {
    await supabase.from('equipment').update({ checked_out_by: null, checked_out_at: null }).eq('id', item.id)
    await load()
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold text-ink">Equipamento</h1>
        {isAdminOrManager && <Button onClick={() => setShowForm((v) => !v)}>+ Novo item</Button>}
      </div>

      {showForm && (
        <Card className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Nome" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            <Input label="Tipo" placeholder="ex: payload, comando, tablet" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} />
          </div>
          <Input label="Número de série (opcional)" value={form.serial_number} onChange={(e) => setForm((f) => ({ ...f, serial_number: e.target.value }))} />
          <div className="flex gap-2">
            <Button onClick={handleCreate} disabled={busy}>Guardar</Button>
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
          </div>
        </Card>
      )}

      {loading ? (
        <p className="text-muted text-sm">A carregar...</p>
      ) : items.length === 0 ? (
        <EmptyState title="Sem equipamento registado" />
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {items.map((item) => (
            <Card key={item.id}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-ink font-medium">{item.name}</p>
                  <p className="text-muted text-xs">{item.type}</p>
                </div>
                <Badge status={item.status}>{item.status}</Badge>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <p className="mono text-xs text-muted">
                  {item.checked_out_by
                    ? `Com ${item.profiles?.full_name || '—'}`
                    : 'Disponível'}
                </p>
                {item.checked_out_by === user?.id ? (
                  <button className="text-xs text-cyan hover:underline" onClick={() => handleCheckIn(item)}>Devolver</button>
                ) : !item.checked_out_by ? (
                  <button className="text-xs text-amber hover:underline" onClick={() => handleCheckOut(item)}>Levantar</button>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
