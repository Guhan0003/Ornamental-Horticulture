/**
 * The care details — light, water, soil, pet safety.
 * Rendered as a definition list so it stays readable and accessible.
 */
export default function Facts({ items = [] }) {
  return (
    <dl className="block block--facts">
      {items.map((item) => (
        <div className="fact" key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}
