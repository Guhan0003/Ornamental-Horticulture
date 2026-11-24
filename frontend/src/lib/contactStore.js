/**
 * The shop's contact details as the site is using them right now.
 *
 * It starts as the details built into the site, with whatever the phone remembered
 * from the last visit laid over them, so the first paint already has a number. Then
 * the server's answer arrives (kept at the CDN, so it is quick) and replaces them,
 * and every button that is built from a number is redrawn.
 *
 * Which settings exist, and how they are laid over the built-in ones, is in
 * contact.js; this only keeps the result and tells whoever is watching. It does not
 * fetch anything itself (App does, once per visit), so the pure helpers that read
 * from it can still be tested without a browser.
 */
import { useSyncExternalStore } from 'react'
import { contact as builtIn } from '../data/contact.js'
import { mergeContact } from './contact.js'

const KEY = 'stomatalworld.contact'

function remembered() {
  try {
    return JSON.parse(localStorage.getItem(KEY))
  } catch {
    // Private mode, nothing stored, or text that is not JSON: use what is built in.
    return null
  }
}

let current = mergeContact(builtIn, remembered())
const listeners = new Set()

export const getContact = () => current

export const subscribe = (listener) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Use what the server says the saved details are, and remember it for next time. */
export function setSavedContact(saved) {
  current = mergeContact(builtIn, saved)
  try {
    localStorage.setItem(KEY, JSON.stringify(saved))
  } catch {
    /* it just starts from the built-in details next time */
  }
  listeners.forEach((listener) => listener())
}

export const useContact = () => useSyncExternalStore(subscribe, getContact)
