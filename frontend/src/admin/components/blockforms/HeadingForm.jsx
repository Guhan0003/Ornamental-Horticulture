export default function HeadingForm({ data, onChange }) {
  return (
    <div className="block-form">
      <label className="field">
        <span>Heading</span>
        <input
          value={data.text ?? ''}
          onChange={(e) => onChange({ ...data, text: e.target.value })}
          placeholder="Care instructions"
        />
      </label>
      <label className="field field--narrow">
        <span>Size</span>
        <select
          value={data.level ?? 2}
          onChange={(e) => onChange({ ...data, level: Number(e.target.value) })}
        >
          <option value={2}>Large</option>
          <option value={3}>Medium</option>
          <option value={4}>Small</option>
        </select>
      </label>
    </div>
  )
}
