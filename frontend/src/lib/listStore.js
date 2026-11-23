/**
 * The list as the phone keeps it.
 *
 * One list for the whole site, held here and mirrored into localStorage, so a
 * plant added on the home page is still there on a plant's page, after a
 * reload, and tomorrow. Every button that shows "added" and the "My list"
 * pill read from it, so they cannot disagree.
 *
 * The rules for changing the list are in list.js; this only keeps the result
 * and tells whoever is watching.
 */
import { useSyncExternalStore } from 'react'
import {
  MAX_ITEMS,
  addItem,
  hasItem,
  parseStored,
  refreshItems,
  removeItem,
  setQty,
} from './list.js'

const KEY = 'stomatalworld.list'

function load() {
  try {
    return parseStored(localStorage.getItem(KEY))
  } catch {
    // Private mode, or storage switched off: the list lasts for this visit only.
    return []
  }
}

// `open` is whether the list's sheet is showing, kept here so a button on a
// plant's page can open it.
let state = { items: load(), open: false }
const listeners = new Set()

function commit(next) {
  state = next
  listeners.forEach((listener) => listener())
}

function setItems(items) {
  if (items === state.items) return
  try {
    localStorage.setItem(KEY, JSON.stringify(items))
  } catch {
    /* it just won't be there tomorrow */
  }
  commit({ ...state, items })
}

export const subscribe = (listener) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const getState = () => state

// The same site open in a second tab: follow the list there.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === KEY || event.key === null) commit({ ...state, items: load() })
  })
}

/* ---------------- changing it ---------------- */

export const addToList = (plant) => setItems(addItem(state.items, plant))
export const removeFromList = (slug) => setItems(removeItem(state.items, slug))
export const changeQty = (slug, qty) => setItems(setQty(state.items, slug, qty))
export const clearList = () => setItems([])
export const refreshList = (plants) => setItems(refreshItems(state.items, plants))

export const openList = () => {
  if (!state.open) commit({ ...state, open: true })
}
export const closeList = () => {
  if (state.open) commit({ ...state, open: false })
}

/* ---------------- watching it ---------------- */

export const useList = () => useSyncExternalStore(subscribe, getState)

// These two answer a yes or no, so the fifty-odd cards on the home page only
// redraw when their own answer changes, not every time any plant is added.
export const useInList = (slug) => useSyncExternalStore(subscribe, () => hasItem(state.items, slug))
export const useListFull = () => useSyncExternalStore(subscribe, () => state.items.length >= MAX_ITEMS)
