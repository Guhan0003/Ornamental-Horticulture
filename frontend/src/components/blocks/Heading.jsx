export default function Heading({ text, level = 2 }) {
  const Tag = `h${Math.min(Math.max(level, 2), 4)}`
  return <Tag className="block block--heading">{text}</Tag>
}
