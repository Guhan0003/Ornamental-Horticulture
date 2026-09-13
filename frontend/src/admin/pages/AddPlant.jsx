import { useNavigate } from 'react-router-dom'
import * as api from '../../lib/api.js'
import { emptyPlant } from '../../lib/plantFormat.js'
import PlantForm from '../components/PlantForm.jsx'

/** Tab 2: a new plant. Saving publishes its page straight away. */
export default function AddPlant() {
  const navigate = useNavigate()

  async function save(payload) {
    const created = await api.createPlant(payload)
    navigate(`/admin/plants/${created.slug}`, { replace: true, state: { created: true } })
    return null
  }

  return (
    <>
      <div className="admin__head">
        <div>
          <h1>Add plant</h1>
          <p className="admin__sub">
            Fields marked * are required. The page goes live as soon as you save.
          </p>
        </div>
      </div>

      <PlantForm initial={emptyPlant()} isNew onSave={save} />
    </>
  )
}
