import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home.jsx'
import PlantPage from './pages/PlantPage.jsx'
import NotFound from './pages/NotFound.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      {/* the QR-code target: one plant, one URL */}
      <Route path="/plant/:slug" element={<PlantPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
