import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Card, Button, Badge, Input, Select, EmptyState } from '../components/ui'

function daysUntil(dateStr) {
  if (!dateStr) return null
  const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  return diff
}

function ExpiryTag({ date }) {
  if (!date) return <span className="text-muted text-xs">sem validade definida</span>
  const days = daysUntil(date)
  const label = new Date(date).toLocaleDateString('pt-PT')
  if (days < 0) return <span className="mono text-xs text-alert">Expirado em {label}</span>
  if (days <= 30) return <span className="mono text-xs text-amber">Expira em {label} ({days}d)</span>
  return <span className="mono text-xs text-muted">Válido até {label}</span>
}

export default function Users() {
  const { isAdminOrManager, profile: myProfile } = useAuth()
  const [profiles, setProfiles] = useState([])
  const [certsByUser, setCertsByUser] = useState({})
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  async function load() {
    setLoading(true)
    const { data: p } = await supabase.from('profiles').select('*').order('full_name')
    const { data: c } = await supabase.from('certifications').select('*')
    const grouped = {}
    for (const cert of c || []) {
      grouped[cert.profile_id] = grouped[cert.profile_id] || []
      grouped[cert.profile_id].push(cert)
    }
    setProfiles(p || [])
    setCertsByUser(grouped)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const visibleProfiles = isAdminOrManager
    ? profiles
    : profiles.filter((p) => p.id === myProfile?.id)

  return (
    <div className="space-y-5">
      <h1 className="font-display text-xl font-semibold text-ink">
        {isAdminOrManager ? 'Utilizadores' : 'O meu perfil'}
      </h1>

      {loading ? (
        <p className="text-muted text-sm">A carregar...</p>
      ) : visibleProfiles.length === 0 ? (
        <EmptyState title="Sem utilizadores" />
      ) : (
        <div className="space-y-2">
          {visibleProfiles.map((p) => {
            const certs = certsByUser[p.id] || []
            const isOpen = expanded === p.id
            return (
              <Card key={p.id}>
                <button
                  className="w-full flex items-center justify-between text-left"
                  onClick={() => setExpanded(isOpen ? null : p.id)}
                >
                  <div>
                    <p className="text-ink font-medium">{p.full_name}</p>
                    <p className="text-muted text-xs mono">{p.email}</p>
                  </div>
                  <span className="mono text-xs px-2 py-0.5 rounded-full border border-border text-muted capitalize">
                    {p.role}
                  </span>
                </button>

                {isOpen && (
                  <div className="mt-4 pt-4 border-t border-border space-y-2">
                    <p className="text-xs text-muted mb-2">Habilitações</p>
                    {certs.length === 0 ? (
                      <p className="text-muted text-xs">Sem certificações registadas.</p>
                    ) : (
                      certs.map((c) => (
                        <div key={c.id} className="flex items-center justify-between text-sm bg-panel2 rounded-lg px-3 py-2">
                          <span className="text-ink">{c.type}</span>
                          <ExpiryTag date={c.expires_at} />
                        </div>
                      ))
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
