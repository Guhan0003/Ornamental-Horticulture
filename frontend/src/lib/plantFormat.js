/**
 * The shape of a plant page, shared by the public page and the admin form.
 * Keep in step with backend/app/schemas/plant.py.
 */

export const LIGHT_SCALE = ['Low', 'Medium', 'Bright indirect', 'Direct sun']

export const ENVIRONMENTS = ['Indoor', 'Outdoor', 'Indoor & outdoor']

export const DEEP_DIVE_ICONS = [
  { name: 'origin', label: 'Origin' },
  { name: 'water', label: 'Water' },
  { name: 'sun', label: 'Light' },
  { name: 'sparkle', label: 'Feature' },
  { name: 'paw', label: 'Pets' },
  { name: 'pot', label: 'Potting' },
  { name: 'landscape', label: 'Garden' },
  { name: 'home', label: 'Home' },
]

export const LIMITS = { snap: 600, deepDiveBody: 1500 }

/** A new plant starts with the four standard Deep Dive points, ready to fill in. */
export const emptyPlant = () => ({
  slug: '',
  common_name: '',
  scientific_name: '',
  image: { url: '', alt: '', placeholder: '', background: '' },
  profile: {
    environment: '',
    light: { label: '', note: '', ideal: [], tolerates: [] },
    landscape_use: { items: [], note: '' },
    home_use: { items: [], note: '' },
  },
  snap: '',
  deep_dive: [
    { icon: 'origin', title: 'Origin & Habit', body: '' },
    { icon: 'water', title: 'Key Care Rule', body: '' },
    { icon: 'sparkle', title: 'Special Feature', body: '' },
    { icon: 'paw', title: 'Pet Safety', body: '' },
  ],
})

export const slugify = (value) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
