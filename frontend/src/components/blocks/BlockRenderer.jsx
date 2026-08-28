import Heading from './Heading.jsx'
import Text from './Text.jsx'
import Image from './Image.jsx'
import Gallery from './Gallery.jsx'
import Facts from './Facts.jsx'

/**
 * The dynamic page format.
 *
 * A plant page is not a hardcoded template — it is an ordered list of blocks
 * composed in the admin panel. Adding a new kind of section means adding one
 * component here and one entry in this registry; no page rewrite.
 *
 * Each block from the API looks like:  { id, type, position, data: {...} }
 */
const REGISTRY = {
  heading: Heading,
  text: Text,
  image: Image,
  gallery: Gallery,
  facts: Facts,
}

export default function BlockRenderer({ blocks = [] }) {
  return (
    <>
      {blocks.map((block) => {
        const Component = REGISTRY[block.type]

        // Unknown block type: skip it rather than crash the whole page.
        // A visitor standing in a store must still get a readable page.
        if (!Component) {
          if (import.meta.env.DEV) {
            console.warn(`No renderer for block type "${block.type}"`)
          }
          return null
        }

        return <Component key={block.id} {...block.data} />
      })}
    </>
  )
}
