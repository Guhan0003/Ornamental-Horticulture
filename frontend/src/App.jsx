import { Suspense, lazy, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home.jsx'
import OrderPage from './pages/OrderPage.jsx'
import PlantPage from './pages/PlantPage.jsx'
import NotFound from './pages/NotFound.jsx'
import ContactButton from './components/ContactButton.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import MyList from './components/MyList.jsx'
import { getSettings } from './lib/api.js'
import { setSavedContact, useContact } from './lib/contactStore.js'

// Loaded only when an admin route is opened. A customer in a shop is on a
// phone and a weak connection; the dashboard has no business in that download.
const AdminRoutes = lazy(() => import('./admin/AdminRoutes.jsx'))

export default function App() {
  // The phone and WhatsApp numbers, the email and the Instagram handle come from the
  // dashboard's Settings. Until they arrive the site uses the ones built into it, and
  // asking costs almost nothing because the answer is kept at the CDN. Subscribing
  // here redraws every button built from a number when the real ones land.
  useContact()
  useEffect(() => {
    getSettings()
      .then(setSavedContact)
      .catch(() => {
        /* the built-in details are already on the page */
      })
  }, [])

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

        {/* a customer's whole order with its photos, linked from their WhatsApp message */}
        <Route path="/order" element={<OrderPage />} />

        {/* one plant, one permanent URL: /peace-lily. Static routes above win. */}
        <Route path="/:slug" element={<PlantPage />} />

        <Route path="*" element={<NotFound />} />
      </Routes>

      {/* bottom-left contact button on every public page; hidden in the admin */}
      <ContactButton />

      {/* bottom-centre "My list" pill and its sheet on every public page; hidden in the admin */}
      <MyList />
    </ErrorBoundary>
  )
}
