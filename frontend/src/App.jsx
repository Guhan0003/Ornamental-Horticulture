import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home.jsx'
import PlantPage from './pages/PlantPage.jsx'
import NotFound from './pages/NotFound.jsx'
import { AuthProvider } from './admin/AuthContext.jsx'
import RequireAuth from './admin/RequireAuth.jsx'
import AdminLayout from './admin/components/AdminLayout.jsx'
import Login from './admin/pages/Login.jsx'
import AllPlants from './admin/pages/AllPlants.jsx'
import AddPlant from './admin/pages/AddPlant.jsx'
import EditPlant from './admin/pages/EditPlant.jsx'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* public */}
        <Route path="/" element={<Home />} />

        {/* admin — not linked from anywhere public */}
        <Route path="/admin/login" element={<Login />} />
        <Route
          path="/admin"
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

        {/* one plant, one permanent URL: /peace-lily. Static routes above win. */}
        <Route path="/:slug" element={<PlantPage />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  )
}
