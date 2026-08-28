import { NavLink, Outlet } from 'react-router-dom'
import Leaf from '../../components/Leaf.jsx'
import { useAuth } from '../AuthContext.jsx'

export default function AdminLayout() {
  const { user, signOut } = useAuth()

  return (
    <div className="admin">
      <header className="admin__bar">
        <div className="admin__brand">
          <Leaf className="admin__leaf" />
          <span>StomatalWorld</span>
        </div>

        <nav className="admin__nav">
          <NavLink to="/admin" end>Plants</NavLink>
          <NavLink to="/admin/categories">Categories</NavLink>
        </nav>

        <div className="admin__account">
          <span className="admin__who">{user?.full_name || user?.email}</span>
          <button type="button" className="btn btn--ghost" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>

      <main className="admin__body">
        <Outlet />
      </main>
    </div>
  )
}
