export default function TextForm({ data, onChange }) {
  return (
    <label className="field">
      <span>Text</span>
      <textarea
        rows={5}
        value={data.body ?? ''}
        onChange={(e) => onChange({ ...data, body: e.target.value })}
        placeholder="A climbing evergreen from the rainforests of southern Mexico…"
      />
    </label>
  )
}
