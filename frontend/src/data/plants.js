import peaceLily from '../assets/plants/peace-lily.webp'

/**
 * Plant content, hardcoded until the admin dashboard and API take over.
 *
 * Keyed by slug — the permanent address, /peace-lily. Every plant follows the
 * same shape, so the page template never needs to change for a new plant.
 */
export const LIGHT_SCALE = ['Low', 'Medium', 'Bright indirect', 'Direct sun']

export const plants = {
  'peace-lily': {
    slug: 'peace-lily',
    commonName: 'Peace Lily',
    scientificName: 'Spathiphyllum wallisii',

    image: {
      src: peaceLily,
      alt: 'A peace lily in a white pot, with glossy dark leaves and white flowers',
      // Sampled from the photo so the page around it blends in.
      background: '#c3c4c9',
      // 20px blurred preview, shown while the real photo loads on a slow connection.
      placeholder:
        'data:image/webp;base64,UklGRsQAAABXRUJQVlA4ILgAAABQBQCdASoUABoAPrVGnEqnI6KhsBgMAOAWiUAYyGWCckCtVZksRW4P8lLQ6qimaWWzKQAA/sP9tu9yzxFkiqukE1IVudx4g6KPtfTC1LRkvm0VS3w11u8oVJt+gFOt+SIVWGK9MNHfu7tMlrjSxu6KMxbcH3HAtrQJR8/y1LvdDJ0gN7ygA6vfWm/nhoDR4ZMw8L1L3SMmsO8uyoIRP0OrztjWq+OGFWO7+OFdnc3ndlT26VPLg0AA',
    },

    profile: {
      environment: 'Indoor',
      light: {
        label: 'Medium to bright indirect light',
        note: 'Tolerates low light',
        // Indexes into LIGHT_SCALE.
        ideal: [1, 2],
        tolerates: [0],
      },
      landscapeUse: {
        items: ['Shaded tropical borders', 'Mass groundcover'],
        note: 'Frost-free zones',
      },
      homeUse: {
        items: ['Tabletop accent', 'Floor plant', 'Air-purifying space cleaner'],
      },
    },

    snap:
      'An elegant indoor staple known for glossy dark leaves and striking white spathes that signal thirst by gently drooping before springing back after watering.',

    deepDive: [
      {
        icon: 'origin',
        title: 'Origin & Habit',
        body: 'Native to tropical rainforests of Central and South America; forms dense clumps of dark green foliage up to 1–3 feet tall.',
      },
      {
        icon: 'water',
        title: 'Key Care Rule',
        body: 'Keep soil consistently moist but never waterlogged; drooping leaves mean it is time to water immediately.',
      },
      {
        icon: 'sparkle',
        title: 'Special Feature',
        body: 'Highly effective at filtering indoor toxins (like benzene and formaldehyde) and blooms continuously in warm, humid conditions.',
      },
      {
        icon: 'paw',
        title: 'Pet Safety',
        body: 'Toxic to cats and dogs if chewed or swallowed; its calcium oxalate crystals irritate the mouth and stomach. Keep it out of reach of pets and small children.',
      },
    ],
  },
}

export const getPlant = (slug) => plants[slug] ?? null

export const listPlants = () =>
  Object.values(plants).sort((a, b) => a.commonName.localeCompare(b.commonName))
