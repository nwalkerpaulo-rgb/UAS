import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Button, Input } from '../components/ui'

export default function Login() {
  const { signIn, session, loading } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  if (!loading && session) return <Navigate to="/" replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await signIn(email, password)
      navigate('/')
    } catch (err) {
      setError(err.message === 'Invalid login credentials'
        ? 'Email ou palavra-passe incorretos.'
        : 'Não foi possível iniciar sessão. Tenta novamente.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-base flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/icon-192.png" alt="" className="w-16 h-16 rounded-xl mx-auto mb-3" />
          <div className="font-display font-bold text-2xl text-ink">GIOP</div>
          <p className="text-muted text-sm mt-1">UAS C-UAS Operações</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-panel border border-border rounded-xl p-6 space-y-4">
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nome@operacao.pt"
          />
          <Input
            label="Palavra-passe"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />

          {error && (
            <p className="text-alert text-sm mono">{error}</p>
          )}

          <Button type="submit" disabled={busy} className="w-full">
            {busy ? 'A entrar...' : 'Entrar'}
          </Button>
        </form>
      </div>
    </div>
  )
}
