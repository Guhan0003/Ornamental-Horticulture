import { isSoldOut } from '../lib/commerce.js'
import { addToList, openList, removeFromList, useInList, useListFull } from '../lib/listStore.js'
import '../styles/mylist.css'

const Plus = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 5.5v13M5.5 12h13" />
  </svg>
)

const Check = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="m5.5 12.5 4.2 4.2 8.8-9.4" />
  </svg>
)

/**
 * The small round button on a plant's card: a + that becomes a tick once the
 * plant is on the list, and takes it off again when pressed a second time.
 *
 * It is a button beside the card's link, not inside it (see PlantCard).
 */
export function CardAdd({ plant }) {
  const inList = useInList(plant.slug)
  const full = useListFull() && !inList

  if (isSoldOut(plant)) return null

  return (
    <button
      type="button"
      className={`card-add${inList ? ' is-in' : ''}`}
      aria-pressed={inList}
      aria-label={
        inList
          ? `Remove ${plant.common_name} from my list`
          : full
            ? 'My list is full'
            : `Add ${plant.common_name} to my list`
      }
      disabled={full}
      title={full ? 'My list is full' : undefined}
      onClick={() => (inList ? removeFromList(plant.slug) : addToList(plant))}
    >
      {inList ? <Check /> : <Plus />}
    </button>
  )
}

/**
 * The wider button under "Order on WhatsApp" on a plant's own page.
 *
 * Once the plant is on the list this opens the list rather than taking the
 * plant off: someone who has just added a plant here wants to see the list or
 * send it, and taking a plant off is one tap in there.
 */
export function PlantAdd({ plant }) {
  const inList = useInList(plant.slug)
  const full = useListFull() && !inList

  if (isSoldOut(plant)) return null

  if (inList) {
    return (
      <button type="button" className="pl-add is-in" onClick={openList}>
        <Check />
        In my list · view
      </button>
    )
  }

  return (
    <button type="button" className="pl-add" disabled={full} onClick={() => addToList(plant)}>
      <Plus />
      {full ? 'My list is full' : 'Add to my list'}
    </button>
  )
}
