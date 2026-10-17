import { Suspense, lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home.jsx'
import PlantPage from './pages/PlantPage.jsx'
import NotFound from './pages/NotFound.jsx'
import ContactButton from './components/ContactButton.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

// Loaded only when an admin route is opened. A customer in a shop is on a
// phone and a weak connection; the dashboard has no business in that download.
const AdminRoutes = lazy(() => import('./admin/AdminRoutes.jsx'))

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        {/* public */}
        <Route path="/" element={<Home />} />

        {/* admin — not linked from anywhere public */}
        <Route
          path="/admin/*"
          element={
            <Suspense fallback={<div className="admin-loading">Loading…</div>}>
              <AdminRoutes />
            </Suspense>
          }
        />

        {/* one plant, one permanent URL: /peace-lily. Static routes above win. */}
        <Route path="/:slug" element={<PlantPage />} />

        <Route path="*" element={<NotFound />} />
      </Routes>

      {/* bottom-left contact button on every public page; hidden in the admin */}
      <ContactButton />
    </ErrorBoundary>
  )
}
