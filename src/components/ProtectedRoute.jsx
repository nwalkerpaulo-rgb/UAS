import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { session, loading, isAdminOrManager } = useAuth()

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-base">
        <span className="mono text-muted text-sm">A carregar...</span>
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />
  if (adminOnly && !isAdminOrManager) return <Navigate to="/" replace />

  return children
}
