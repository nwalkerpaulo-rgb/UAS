import { useEffect, useRef, useState } from 'react'
import Hls from 'hls.js'
import { supabase } from '../lib/supabase'

// Reproduz um feed HLS do MediaMTX, autenticado com o token de sessão
// Supabase da pessoa (passado como query param — ver verify-stream-auth).
export default function LiveStreamPlayer({ streamBaseUrl, path, label }) {
  const videoRef = useRef(null)
  const hlsRef = useRef(null)
  const [status, setStatus] = useState('loading') // loading | playing | error | offline

  useEffect(() => {
    let cancelled = false

    async function start() {
      const { data } = await supabase.auth.getSession()
      const token = data?.session?.access_token
      if (!token) {
        setStatus('error')
        return
      }

      const url = `${streamBaseUrl}/${path}/index.m3u8?token=${encodeURIComponent(token)}`
      const video = videoRef.current
      if (!video) return

      if (Hls.isSupported()) {
        const hls = new Hls({ maxLiveSyncPlaybackRate: 1.5 })
        hlsRef.current = hls
        hls.loadSource(url)
        hls.attachMedia(video)
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (!cancelled) {
            setStatus('playing')
            video.play().catch(() => {})
          }
        })
        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (data.fatal && !cancelled) setStatus('offline')
        })
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari — suporte nativo de HLS
        video.src = url
        video.addEventListener('loadedmetadata', () => {
          if (!cancelled) {
            setStatus('playing')
            video.play().catch(() => {})
          }
        })
      } else {
        setStatus('error')
      }
    }

    start()

    return () => {
      cancelled = true
      hlsRef.current?.destroy()
    }
  }, [streamBaseUrl, path])

  return (
    <div className="rounded-xl overflow-hidden border border-border bg-black relative">
      <video ref={videoRef} muted controls playsInline className="w-full aspect-video bg-black" />
      <div className="absolute top-2 left-2 flex items-center gap-2 bg-black/60 px-2 py-1 rounded-md">
        <span className={`w-2 h-2 rounded-full ${status === 'playing' ? 'bg-ok animate-pulse' : status === 'offline' ? 'bg-muted' : 'bg-alert'}`} />
        <span className="text-xs text-ink">{label}</span>
      </div>
      {status === 'offline' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
          <p className="text-muted text-sm">Sem sinal — feed offline ou não iniciado</p>
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
          <p className="text-alert text-sm">Não foi possível autenticar o stream</p>
        </div>
      )}
    </div>
  )
}
