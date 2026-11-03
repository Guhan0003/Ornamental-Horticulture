import { Suspense, lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import { LazyMotion, MotionConfig, domAnimation } from 'motion/react'
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
    // `m` components with only the animation features the public pages use,
    // instead of the full `motion` bundle; `strict` stops a stray `motion.div`
    // from quietly pulling the rest back in. Phones set to reduce motion get
    // fades only, with nothing sliding or scaling.
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <AppRoutes />
      </MotionConfig>
    </LazyMotion>
  )
}

function AppRoutes() {
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
