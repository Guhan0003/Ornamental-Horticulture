import { useState } from 'react'

/** A short list typed as chips: Enter or comma adds, × removes. */
export default function ChipsInput({ items, onChange, placeholder, label }) {
  const [draft, setDraft] = useState('')

  function commit() {
    const value = draft.trim().replace(/,$/, '').trim()
    if (value && !items.some((item) => item.toLowerCase() === value.toLowerCase())) {
      onChange([...items, value])
    }
    setDraft('')
  }

  function onKeyDown(event) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      commit()
    } else if (event.key === 'Backspace' && !draft && items.length) {
      onChange(items.slice(0, -1))
    }
  }

  return (
    <div className="chips-input">
      {items.map((item) => (
        <span className="chips-input__chip" key={item}>
          {item}
          <button
            type="button"
            onClick={() => onChange(items.filter((i) => i !== item))}
            aria-label={`Remove ${item}`}
          >
            ×
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={commit}
        placeholder={items.length ? 'Add another…' : placeholder}
        aria-label={label}
        maxLength={80}
      />
    </div>
  )
}
