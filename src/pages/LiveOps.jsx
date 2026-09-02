import { useState } from 'react'
import LiveStreamPlayer from '../components/LiveStreamPlayer'
import { Card, Input } from '../components/ui'

// Endereço base do teu MediaMTX (porta HLS, normalmente 8888).
// Ajusta aqui, ou torna configurável em Configurações mais tarde.
const DEFAULT_STREAM_BASE_URL = 'https://o-teu-servidor-de-video.exemplo.com:8888'

export default function LiveOps() {
  const [streamBaseUrl, setStreamBaseUrl] = useState(
    localStorage.getItem('stream_base_url') || DEFAULT_STREAM_BASE_URL
  )

  function updateBaseUrl(value) {
    setStreamBaseUrl(value)
    localStorage.setItem('stream_base_url', value)
  }

  const notConfigured = streamBaseUrl.includes('o-teu-servidor')

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-xl font-semibold text-ink">Operações ao Vivo</h1>
        <p className="text-muted text-sm mt-1">Feeds de vídeo em tempo real do drone e do sistema C-UAS.</p>
      </div>

      <Card>
        <Input
          label="Endereço do servidor de vídeo (MediaMTX)"
          value={streamBaseUrl}
          onChange={(e) => updateBaseUrl(e.target.value)}
          placeholder="https://o-teu-servidor.exemplo.com:8888"
        />
        <p className="text-muted text-[10px] mt-1.5">Guardado só neste dispositivo — cada pessoa configura uma vez.</p>
      </Card>

      {notConfigured ? (
        <Card>
          <p className="text-amber text-sm">Configura o endereço do servidor de vídeo acima antes de continuar.</p>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <p className="text-muted text-xs mb-2">Drone</p>
            <LiveStreamPlayer streamBaseUrl={streamBaseUrl} path="drone1" label="Drone — feed ao vivo" />
          </div>
          <div>
            <p className="text-muted text-xs mb-2">C-UAS</p>
            <LiveStreamPlayer streamBaseUrl={streamBaseUrl} path="cuas1" label="C-UAS — feed ao vivo" />
          </div>
        </div>
      )}
    </div>
  )
}
