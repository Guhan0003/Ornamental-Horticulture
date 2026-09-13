import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext.jsx'

export default function RequireAuth({ children }) {
  const { user, loading, unreachable } = useAuth()
  const location = useLocation()

  // Don't redirect while the stored token is still being verified, or a
  // refresh would bounce a signed-in admin back to the login screen.
  if (loading) return <div className="admin-loading">Checking your session…</div>

  if (!user && unreachable) {
    return (
      <div className="admin-loading" role="alert">
        <p>Couldn’t reach the server to check your session.</p>
        <button type="button" className="btn btn--ghost" onClick={() => window.location.reload()}>
          Try again
        </button>
      </div>
    )
  }

  if (!user) return <Navigate to="/admin/login" state={{ from: location }} replace />

  return children
}
