import { useId, useMemo, useState } from 'react'
import Icon from './Icon.jsx'
import { estimateDelivery, formatDay, isPincode, savePincode } from '../lib/delivery.js'

/**
 * "Check delivery date": a pincode in, a range of dates out.
 *
 * Built for a thumb. The field opens the number keypad, drops anything that
 * isn't a digit, and is as tall as a button; the answer is a date, because
 * nobody counts working days on their fingers.
 *
 * The page owns the checked pincode (`pincode`, null until one is checked), so
 * the order button can put it in the WhatsApp message.
 */
export default function DeliveryCheck({ pincode, onCheck }) {
  const inputId = useId()
  const noteId = useId()
  const [draft, setDraft] = useState(pincode ?? '')
  const [error, setError] = useState(null)

  const estimate = useMemo(() => (pincode ? estimateDelivery(pincode) : null), [pincode])

  function change(event) {
    const value = event.target.value.replace(/\D/g, '').slice(0, 6)
    setDraft(value)
    setError(null)
    // Changing the number un-checks it, so a stale answer (and a stale pincode
    // in the order message) never sits beside a different number.
    if (pincode && value !== pincode) onCheck(null)
  }

  function submit(event) {
    event.preventDefault()
    if (!isPincode(draft)) {
      setError('Enter the 6-digit pincode, like 600001.')
      return
    }
    setError(null)
    savePincode(draft)
    onCheck(draft)
  }

  return (
    <form className="pl-delivery" onSubmit={submit} noValidate>
      <label className="pl-delivery__label" htmlFor={inputId}>
        <Icon name="truck" className="pl-delivery__icon" />
        Check delivery date
      </label>

      <div className="pl-delivery__row">
        <input
          id={inputId}
          className="pl-delivery__input"
          value={draft}
          onChange={change}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="postal-code"
          maxLength={6}
          placeholder="Your pincode"
          aria-invalid={Boolean(error)}
          aria-describedby={error || estimate ? noteId : undefined}
        />
        <button type="submit" className="pl-delivery__go">
          Check
        </button>
      </div>

      <div id={noteId} role="status" aria-live="polite">
        {error && <p className="pl-delivery__error">{error}</p>}

        {estimate && !error && (
          <p className="pl-delivery__result">
            <span className="pl-delivery__eyebrow">Estimated delivery</span>
            {/* Each date is kept whole, so on a narrow phone the line breaks after the dash. */}
            <strong>
              <span className="pl-delivery__date">{formatDay(estimate.earliest)}</span>
              {' – '}
              <span className="pl-delivery__date">{formatDay(estimate.latest)}</span>
            </strong>
            <span className="pl-delivery__how">
              {estimate.minDays}–{estimate.maxDays} working days
            </span>
          </p>
        )}
      </div>
    </form>
  )
}
