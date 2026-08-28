import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext.jsx'

export default function RequireAuth({ children, adminOnly = false }) {
  const { user, loading, isAdmin } = useAuth()
  const location = useLocation()

  // Don't redirect while the stored token is still being verified, or a
  // refresh would bounce a signed-in editor back to the login screen.
  if (loading) return <div className="admin-loading">Checking your session…</div>

  if (!user) return <Navigate to="/admin/login" state={{ from: location }} replace />

  if (adminOnly && !isAdmin) {
    return (
      <div className="admin-empty">
        <h2>Admins only</h2>
        <p>Your account doesn’t have access to this page.</p>
      </div>
    )
  }

  return children
}
