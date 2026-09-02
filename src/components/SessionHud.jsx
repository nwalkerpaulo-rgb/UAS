import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useActiveSession } from '../hooks/useActiveSession'

function elapsed(startedAt) {
  const s = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
  const h = String(Math.floor(s / 3600)).padStart(2, '0')
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const sec = String(s % 60).padStart(2, '0')
  return `${h}:${m}:${sec}`
}

export default function SessionHud() {
  const { activeSession } = useActiveSession()
  const [, tick] = useState(0)

  useEffect(() => {
    if (!activeSession) return
    const id = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [activeSession])

  if (!activeSession) return null

  return (
    <Link
      to={`/sessoes/${activeSession.id}`}
      className="focus-ring block border-b border-amber/30 bg-panel2"
    >
      <div className="max-w-6xl mx-auto px-4 py-2 flex items-center gap-4 text-sm">
        <span className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber"></span>
          </span>
          <span className="text-amber font-medium tracking-wide">SERVIÇO EM CURSO</span>
        </span>
        <span className="mono text-ink">{elapsed(activeSession.started_at)}</span>
        {activeSession.start_lat && (
          <span className="mono text-cyan text-xs hidden sm:inline">
            {activeSession.start_lat.toFixed(4)}, {activeSession.start_lng.toFixed(4)}
          </span>
        )}
        <span className="ml-auto text-muted text-xs">Ver sessão →</span>
      </div>
    </Link>
  )
}
