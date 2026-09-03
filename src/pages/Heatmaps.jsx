import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.heat'
import { supabase } from '../lib/supabase'
import { Card, Select } from '../components/ui'

const DEFAULT_CENTER = [39.5, -8.0]
const DEFAULT_ZOOM = 7

const HEAT_GRADIENTS = {
  operacional: { 0.2: '#1B2740', 0.4: '#5EEAD4', 0.7: '#F5B942', 1.0: '#E64C4C' },
  incidentes: { 0.2: '#1B2740', 0.5: '#F5B942', 1.0: '#E64C4C' },
}

function HeatLayer({ points, gradient }) {
  const map = useMap()

  useEffect(() => {
    if (!points.length) return
    const layer = L.heatLayer(points, { radius: 28, blur: 22, maxZoom: 12, gradient })
    layer.addTo(map)
    return () => {
      map.removeLayer(layer)
    }
  }, [map, points, gradient])

  return null
}

export default function Heatmaps() {
  const [type, setType] = useState('operacional') // 'operacional' | 'incidentes'
  const [missionPoints, setMissionPoints] = useState([])
  const [incidentPoints, setIncidentPoints] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [{ data: m }, { data: i }] = await Promise.all([
        supabase.from('missions').select('lat, lng').not('lat', 'is', null),
        supabase.from('incidents').select('lat, lng, severity').not('lat', 'is', null),
      ])
      setMissionPoints((m || []).map((r) => [r.lat, r.lng, 1]))
      // incidentes pesam mais consoante a gravidade, para o heatmap realçar zonas críticas
      const weightBySeverity = { baixa: 0.4, media: 0.7, alta: 1, critica: 1.3 }
      setIncidentPoints((i || []).map((r) => [r.lat, r.lng, weightBySeverity[r.severity] ?? 0.6]))
      setLoading(false)
    }
    load()
  }, [])

  const points = type === 'operacional' ? missionPoints : incidentPoints
  const gradient = HEAT_GRADIENTS[type]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-display text-xl font-semibold text-ink">Heatmaps</h1>
        <div className="w-52">
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="operacional">Densidade operacional (missões)</option>
            <option value="incidentes">Densidade de incidentes</option>
          </Select>
        </div>
      </div>

      <p className="text-muted text-xs">
        Heatmap de deteções C-UAS fica disponível quando o módulo de deteções estiver ligado.
      </p>

      {loading ? (
        <p className="text-muted text-sm">A carregar...</p>
      ) : points.length === 0 ? (
        <Card>
          <p className="text-muted text-sm">
            Ainda não há {type === 'operacional' ? 'missões' : 'incidentes'} com coordenadas GPS suficientes para gerar um mapa de calor.
          </p>
        </Card>
      ) : (
        <div className="rounded-xl overflow-hidden border border-border" style={{ height: '65vh' }}>
          <MapContainer center={DEFAULT_CENTER} zoom={DEFAULT_ZOOM} style={{ height: '100%', width: '100%', background: '#0D0F14' }}>
            <TileLayer
               url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  className="map-dark-tiles"
  />
            <HeatLayer points={points} gradient={gradient} />
          </MapContainer>
        </div>
      )}

      <p className="text-muted text-xs">
        {points.length} ponto{points.length !== 1 ? 's' : ''} com coordenadas usados no cálculo.
      </p>
    </div>
  )
}
