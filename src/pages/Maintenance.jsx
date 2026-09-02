import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Card, Button, Badge, Input, Select, Textarea, EmptyState } from '../components/ui'

const ASSET_TABLES = {
  drone: 'drones',
  bateria: 'batteries',
  contra_drone: 'counter_drone_systems',
  equipamento: 'equipment',
}

const ASSET_LABELS = {
  drone: 'Drone',
  bateria: 'Bateria',
  contra_drone: 'Contra-Drone',
  equipamento: 'Equipamento',
}

function daysUntil(dateStr) {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

export default function Maintenance() {
  const { isAdminOrManager, user } = useAuth()
  const [records, setRecords] = useState([])
  const [upcoming, setUpcoming] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [assetOptions, setAssetOptions] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const [form, setForm] = useState({
    asset_type: 'drone',
    asset_id: '',
    description: '',
    performed_at: new Date().toISOString().slice(0, 10),
    next_due_at: '',
    next_due_hours: '',
    next_due_cycles: '',
  })

  async function load() {
    setLoading(true)

    const { data: recs } = await supabase
      .from('maintenance_records')
      .select('*, profiles(full_name)')
      .order('performed_at', { ascending: false })
      .limit(30)
    setRecords(recs || [])

    // Alertas: ativos com data de manutenção nos próximos 30 dias, ou já vencida
    const alerts = []
    for (const [assetType, table] of Object.entries(ASSET_TABLES)) {
      const { data } = await supabase
        .from(table)
        .select(assetType === 'equipamento' ? 'id, name, next_maintenance_at' : 'id, name, next_maintenance_at, next_maintenance_hours, next_maintenance_cycles')
        .not('next_maintenance_at', 'is', null)
      for (const item of data || []) {
        const days = daysUntil(item.next_maintenance_at)
        if (days !== null && days <= 30) {
          alerts.push({ assetType, ...item, days })
        }
      }
    }
    alerts.sort((a, b) => a.days - b.days)
    setUpcoming(alerts)

    setLoading(false)
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    async function loadAssetOptions() {
      const table = ASSET_TABLES[form.asset_type]
      const { data } = await supabase.from(table).select('id, name')
      setAssetOptions(data || [])
    }
    loadAssetOptions()
  }, [form.asset_type])

  async function handleCreate() {
    setError(null)
    if (!form.asset_id || !form.description.trim()) {
      setError('Escolhe o ativo e descreve a manutenção.')
      return
    }
    setBusy(true)
    try {
      await supabase.from('maintenance_records').insert({
        asset_type: form.asset_type,
        asset_id: form.asset_id,
        performed_by: user.id,
        performed_at: form.performed_at,
        description: form.description,
        next_due_at: form.next_due_at || null,
        next_due_hours: form.next_due_hours ? Number(form.next_due_hours) : null,
        next_due_cycles: form.next_due_cycles ? Number(form.next_due_cycles) : null,
      })

      // Atualiza a data de próxima manutenção diretamente no ativo, para os alertas
      if (form.next_due_at) {
        const table = ASSET_TABLES[form.asset_type]
        await supabase.from(table).update({ next_maintenance_at: form.next_due_at }).eq('id', form.asset_id)
      }

      setForm({ asset_type: 'drone', asset_id: '', description: '', performed_at: new Date().toISOString().slice(0, 10), next_due_at: '', next_due_hours: '', next_due_cycles: '' })
      setShowForm(false)
      await load()
    } catch (err) {
      setError('Erro ao registar manutenção.')
      console.error(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold text-ink">Manutenção</h1>
        {isAdminOrManager && <Button onClick={() => setShowForm((v) => !v)}>+ Registar manutenção</Button>}
      </div>

      {upcoming.length > 0 && (
        <div>
          <h2 className="font-display font-medium text-ink text-sm mb-2">Alertas — próximos 30 dias</h2>
          <div className="space-y-2">
            {upcoming.map((a) => (
              <Card key={`${a.assetType}-${a.id}`} className="flex items-center justify-between">
                <div>
                  <p className="text-ink text-sm">{a.name}</p>
                  <p className="text-muted text-xs">{ASSET_LABELS[a.assetType]}</p>
                </div>
                <Badge status={a.days < 0 ? 'inativo' : a.days <= 7 ? 'manutencao' : 'operacional'}>
                  {a.days < 0 ? `Vencida há ${Math.abs(a.days)}d` : `Em ${a.days}d`}
                </Badge>
              </Card>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <Card className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Tipo de ativo"
              value={form.asset_type}
              onChange={(e) => setForm((f) => ({ ...f, asset_type: e.target.value, asset_id: '' }))}
            >
              {Object.entries(ASSET_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
            <Select label="Ativo" value={form.asset_id} onChange={(e) => setForm((f) => ({ ...f, asset_id: e.target.value }))}>
              <option value="">Escolhe...</option>
              {assetOptions.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </div>

          <Textarea label="Descrição da manutenção" rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />

          <Input label="Data" type="date" value={form.performed_at} onChange={(e) => setForm((f) => ({ ...f, performed_at: e.target.value }))} />

          <p className="text-xs text-muted">Próxima manutenção prevista (preenche o que fizer sentido)</p>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Data" type="date" value={form.next_due_at} onChange={(e) => setForm((f) => ({ ...f, next_due_at: e.target.value }))} />
            <Input label="Horas de voo" type="number" value={form.next_due_hours} onChange={(e) => setForm((f) => ({ ...f, next_due_hours: e.target.value }))} />
            <Input label="Ciclos" type="number" value={form.next_due_cycles} onChange={(e) => setForm((f) => ({ ...f, next_due_cycles: e.target.value }))} />
          </div>

          {error && <p className="text-alert text-sm">{error}</p>}
          <div className="flex gap-2">
            <Button onClick={handleCreate} disabled={busy}>Guardar</Button>
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
          </div>
        </Card>
      )}

      <div>
        <h2 className="font-display font-medium text-ink text-sm mb-2">Histórico</h2>
        {loading ? (
          <p className="text-muted text-sm">A carregar...</p>
        ) : records.length === 0 ? (
          <EmptyState title="Sem manutenções registadas" />
        ) : (
          <div className="space-y-2">
            {records.map((r) => (
              <Card key={r.id}>
                <div className="flex items-center justify-between">
                  <p className="text-ink text-sm">{r.description}</p>
                  <span className="mono text-xs text-muted">{ASSET_LABELS[r.asset_type]}</span>
                </div>
                <p className="mono text-xs text-muted mt-1">
                  {new Date(r.performed_at).toLocaleDateString('pt-PT')}
                  {r.profiles ? ` · ${r.profiles.full_name}` : ''}
                </p>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
