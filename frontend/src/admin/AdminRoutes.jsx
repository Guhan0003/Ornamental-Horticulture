import { Navigate, Route, Routes } from 'react-router-dom'
import './admin.css'
import { AuthProvider } from './AuthContext.jsx'
import RequireAuth from './RequireAuth.jsx'
import AdminLayout from './components/AdminLayout.jsx'
import Login from './pages/Login.jsx'
import AllPlants from './pages/AllPlants.jsx'
import AddPlant from './pages/AddPlant.jsx'
import EditPlant from './pages/EditPlant.jsx'

/**
 * Everything behind /admin, in one module.
 *
 * It is imported lazily, so the dashboard — its pages, its stylesheet and the
 * sign-in machinery — is downloaded only by someone who opens it, and never by
 * a customer scanning a label in a shop.
 */
export default function AdminRoutes() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="login" element={<Login />} />

        <Route
          element={
            <RequireAuth>
              <AdminLayout />
            </RequireAuth>
          }
        >
          <Route index element={<AllPlants />} />
          <Route path="new" element={<AddPlant />} />
          <Route path="plants/:slug" element={<EditPlant />} />
        </Route>

        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </AuthProvider>
  )
}
