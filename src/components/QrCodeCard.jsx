import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { Card, Button } from './ui'

// Mostra o QR code que aponta para o URL atual da página (ficha do
// drone/bateria/sistema). Ao ler o código, quem estiver no terreno vai
// diretamente a esta ficha, sem precisar de navegar pela app.
export default function QrCodeCard({ label }) {
  const canvasRef = useRef(null)
  const [visible, setVisible] = useState(false)
  const url = typeof window !== 'undefined' ? window.location.href : ''

  useEffect(() => {
    if (visible && canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, url, {
        width: 220,
        margin: 2,
        color: { dark: '#0D0F14', light: '#FFFFFF' },
      })
    }
  }, [visible, url])

  function handleDownload() {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `qrcode_${(label || 'ativo').replace(/[^a-z0-9]+/gi, '_')}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  if (!visible) {
    return (
      <button className="text-xs text-cyan hover:underline" onClick={() => setVisible(true)}>
        ▤ Mostrar QR Code
      </button>
    )
  }

  return (
    <Card className="inline-block text-center">
      <canvas ref={canvasRef} className="mx-auto rounded-lg" />
      <p className="text-muted text-xs mt-2">Aponta a câmara para ir diretamente a esta ficha</p>
      <div className="flex items-center justify-center gap-2 mt-3">
        <Button variant="secondary" onClick={handleDownload}>Descarregar PNG</Button>
        <Button variant="ghost" onClick={() => setVisible(false)}>Fechar</Button>
      </div>
    </Card>
  )
}
