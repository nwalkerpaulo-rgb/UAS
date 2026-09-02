import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Card, Badge, Button, EmptyState, Select } from '../components/ui'

const CLASS_LABEL = {
  identificada_autorizada: 'Identificada / Autorizada',
  suspeita: 'Suspeita',
  nao_identificada: 'Não identificada',
}

const CLASS_BADGE = {
  identificada_autorizada: 'operacional',
  suspeita: 'manutencao',
  nao_identificada: 'inativo',
}

export default function Detections() {
  const { isAdminOrManager } = useAuth()
  const [detections, setDetections] = useState([])
  const [loading, setLoading] = useState(true)
  const [classFilter, setClassFilter] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      let query = supabase
        .from('detections')
        .select('*, counter_drone_systems(name), profiles!detections_operator_id_fkey(full_name)')
        .order('occurred_at', { ascending: false })
      if (classFilter) query = query.eq('classification', classFilter)
      const { data } = await query
      setDetections(data || [])
      setLoading(false)
    }
    load()
  }, [classFilter])

  const today = new Date().toDateString()
  const todayCount = detections.filter((d) => new Date(d.occurred_at).toDateString() === today).length

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-display text-xl font-semibold text-ink">
          {isAdminOrManager ? 'Deteções C-UAS — equipa' : 'As minhas deteções'}
        </h1>
        <Link to="/deteccoes/nova">
          <Button>+ Registar deteção</Button>
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card>
          <p className="mono text-xl text-amber">{todayCount}</p>
          <p className="text-muted text-xs mt-1">Deteções hoje</p>
        </Card>
        <Card>
          <p className="mono text-xl text-ok">{detections.filter((d) => d.classification === 'identificada_autorizada').length}</p>
          <p className="text-muted text-xs mt-1">Identificadas</p>
        </Card>
        <Card>
          <p className="mono text-xl text-alert">{detections.filter((d) => d.classification !== 'identificada_autorizada').length}</p>
          <p className="text-muted text-xs mt-1">Suspeitas / não identificadas</p>
        </Card>
      </div>

      <div className="w-56">
        <Select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
          <option value="">Todas as classificações</option>
          <option value="identificada_autorizada">Identificada / Autorizada</option>
          <option value="suspeita">Suspeita</option>
          <option value="nao_identificada">Não identificada</option>
        </Select>
      </div>

      {loading ? (
        <p className="text-muted text-sm">A carregar...</p>
      ) : detections.length === 0 ? (
        <EmptyState title="Sem deteções registadas" />
      ) : (
        <div className="space-y-2">
          {detections.map((d) => (
            <Card key={d.id}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-ink text-sm font-medium">
                    {d.detection_type || 'Deteção'} · {d.counter_drone_systems?.name || 'Sistema desconhecido'}
                  </p>
                  <p className="mono text-xs text-muted mt-0.5">
                    {new Date(d.occurred_at).toLocaleString('pt-PT')}
                    {isAdminOrManager && d.profiles ? ` · ${d.profiles.full_name}` : ''}
                    {d.location_label ? ` · ${d.location_label}` : ''}
                  </p>
                </div>
                <Badge status={CLASS_BADGE[d.classification]}>{CLASS_LABEL[d.classification]}</Badge>
              </div>
              {d.result && <p className="text-muted text-xs mt-2">Resultado: {d.result}</p>}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
