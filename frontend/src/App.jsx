import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home.jsx'
import PlantPage from './pages/PlantPage.jsx'
import NotFound from './pages/NotFound.jsx'
import { AuthProvider } from './admin/AuthContext.jsx'
import RequireAuth from './admin/RequireAuth.jsx'
import AdminLayout from './admin/components/AdminLayout.jsx'
import Login from './admin/pages/Login.jsx'
import PlantList from './admin/pages/PlantList.jsx'
import PlantEditor from './admin/pages/PlantEditor.jsx'
import Categories from './admin/pages/Categories.jsx'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* public */}
        <Route path="/" element={<Home />} />
        {/* the QR-code target: one plant, one URL */}
        <Route path="/plant/:slug" element={<PlantPage />} />

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
          <Route index element={<PlantList />} />
          <Route path="plants/new" element={<PlantEditor />} />
          <Route path="plants/:slug" element={<PlantEditor />} />
          <Route path="categories" element={<Categories />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  )
}
