/**
 * The shop, sorted into the families a customer actually shops by.
 *
 * Nothing new has to be entered for this. Every plant already carries a
 * scientific name, and its first word is the genus, which is the real grouping
 * — so a plant added tomorrow lands in the right section on its own, with no
 * field to remember and nothing to keep in step.
 *
 * The genus is Latin and the shop is not, so each one is shown under the name
 * people use for it: Epipremnum is the Pothos shelf.
 */

const NAMES = {
  Philodendron: 'Philodendron',
  // Xanadu was moved to Thaumatophyllum in 2018. The trade, and the label on
  // the pot, still says Philodendron, so it belongs on that shelf.
  Thaumatophyllum: 'Philodendron',
  Epipremnum: 'Pothos',
  Monstera: 'Monstera',
  Syngonium: 'Syngonium',
  Ficus: 'Ficus & Rubber Plants',
  Zamioculcas: 'ZZ Plant',
  // Three genera are sold as Calathea; splitting them would only confuse.
  Calathea: 'Calathea',
  Ctenanthe: 'Calathea',
  Goeppertia: 'Calathea',
  Aglaonema: 'Aglaonema',
  Anthurium: 'Anthurium',
  Spathiphyllum: 'Peace Lily',
  Chamaedorea: 'Palms',
  Dracaena: 'Snake Plant',
  Sansevieria: 'Snake Plant',
}

/** Where everything else goes, and always the last section. */
export const OTHERS = 'More plants'

/** A heading over a single plant is not a section, it is a stray card. */
const MIN_MEMBERS = 2

/**
 * Shelves that belong next to another one whatever their size. Biggest-first
 * would put the Aglaonemas fourth, behind Syngonium and Pothos, but they are
 * sold as a step on from the Philodendrons and are looked at together.
 */
const NEXT_TO = { Aglaonema: 'Philodendron' }

const genusOf = (plant) => (plant.scientific_name || '').trim().split(/\s+/)[0] || ''

/** The shelf this plant belongs on, or null when its genus isn't one we name. */
export const groupOf = (plant) => NAMES[genusOf(plant)] ?? null

/**
 * The plants in sections, biggest shelf first, with everything too small to be
 * a shelf of its own gathered at the end.
 *
 * Cards keep the order they arrive in, so whatever the caller sorted by still
 * holds inside each section.
 */
export function groupPlants(plants) {
  const shelves = new Map()
  const others = []

  for (const plant of plants) {
    const name = groupOf(plant)
    if (!name) {
      others.push(plant)
      continue
    }
    if (!shelves.has(name)) shelves.set(name, [])
    shelves.get(name).push(plant)
  }

  // A genus with a single plant in stock doesn't earn a heading of its own.
  for (const [name, members] of shelves) {
    if (members.length < MIN_MEMBERS) {
      shelves.delete(name)
      others.push(...members)
    }
  }

  const sections = [...shelves]
    .map(([name, members]) => ({ name, plants: members }))
    .sort((a, b) => b.plants.length - a.plants.length || a.name.localeCompare(b.name))

  // Move each pinned shelf to sit directly under the one it belongs with. If
  // that shelf isn't there (too few plants), the pinned one keeps its place.
  for (const [name, anchor] of Object.entries(NEXT_TO)) {
    const from = sections.findIndex((section) => section.name === name)
    const at = sections.findIndex((section) => section.name === anchor)
    if (from === -1 || at === -1) continue
    const [moved] = sections.splice(from, 1)
    sections.splice(sections.findIndex((section) => section.name === anchor) + 1, 0, moved)
  }

  if (others.length) sections.push({ name: OTHERS, plants: others })
  return sections
}
