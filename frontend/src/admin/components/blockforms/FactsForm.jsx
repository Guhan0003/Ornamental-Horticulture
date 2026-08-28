/** Care details — light, water, soil, pet safety. */
export default function FactsForm({ data, onChange }) {
  const items = data.items ?? []

  const update = (index, patch) =>
    onChange({
      ...data,
      items: items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    })

  const add = () => onChange({ ...data, items: [...items, { label: '', value: '' }] })

  const remove = (index) =>
    onChange({ ...data, items: items.filter((_, i) => i !== index) })

  return (
    <div className="facts-form">
      {items.map((item, index) => (
        <div className="facts-form__row" key={index}>
          <input
            value={item.label ?? ''}
            onChange={(e) => update(index, { label: e.target.value })}
            placeholder="Light"
            aria-label="Label"
          />
          <input
            value={item.value ?? ''}
            onChange={(e) => update(index, { value: e.target.value })}
            placeholder="Bright, indirect"
            aria-label="Value"
          />
          <button
            type="button"
            className="btn btn--icon"
            onClick={() => remove(index)}
            aria-label={`Remove ${item.label || 'row'}`}
          >
            ×
          </button>
        </div>
      ))}

      <button type="button" className="btn btn--ghost" onClick={add}>
        Add a detail
      </button>
    </div>
  )
}
