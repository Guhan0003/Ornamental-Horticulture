import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as api from '../lib/api.js'

const normalise = (value) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()

/**
 * Search box with plant suggestions: a small photo and the name, linking to
 * the plant's page. Focusing it lists every plant; typing narrows the list.
 */
export default function PlantSearch() {
  const navigate = useNavigate()
  const listId = useId()
  const inputRef = useRef(null)

  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [plants, setPlants] = useState(null)
  const [failed, setFailed] = useState(false)

  // One small request for the whole list; filtering happens locally as you type.
  useEffect(() => {
    let cancelled = false
    api
      .listPlants()
      .then((list) => !cancelled && setPlants(list))
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [])

  const results = useMemo(() => {
    const q = normalise(query)
    const all = plants ?? []
    if (!q) return all
    // Scientific names match too, but only the common name is shown.
    return all.filter((plant) =>
      [plant.common_name, plant.scientific_name].some((name) => normalise(name).includes(q)),
    )
  }, [plants, query])

  const go = (plant) => {
    setOpen(false)
    navigate(`/${plant.slug}`)
  }

  function onKeyDown(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      setActive((i) => Math.min(i + 1, results.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (event.key === 'Enter' && open && results[active]) {
      event.preventDefault()
      go(results[active])
    } else if (event.key === 'Escape') {
      setOpen(false)
      inputRef.current?.blur()
    }
  }

  return (
    <div className={`search${open ? ' is-open' : ''}`}>
      <label className="search__field">
        <svg className="search__icon" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4.5 4.5" />
        </svg>
        <span className="visually-hidden">Search plants</span>
        <input
          ref={inputRef}
          type="search"
          placeholder="Search plants"
          autoComplete="off"
          spellCheck="false"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && results[active] ? `${listId}-${active}` : undefined}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
        />
      </label>

      {open && (
        // mousedown would blur the input and close the list before the click lands
        <ul
          className="search__list"
          id={listId}
          role="listbox"
          onMouseDown={(e) => e.preventDefault()}
        >
          {failed ? (
            <li className="search__empty">Couldn’t load plants. Check your connection.</li>
          ) : plants === null ? (
            <li className="search__empty">Loading plants…</li>
          ) : results.length === 0 ? (
            <li className="search__empty">
              {query.trim() ? `No plant called “${query.trim()}” yet` : 'No plants yet'}
            </li>
          ) : (
            results.map((plant, index) => (
              <li
                key={plant.slug}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                className={`search__option${index === active ? ' is-active' : ''}`}
                onMouseEnter={() => setActive(index)}
                onClick={() => go(plant)}
              >
                <img
                  className="search__thumb"
                  src={api.imageSrc(plant.image.url)}
                  alt=""
                  loading="lazy"
                  style={
                    plant.image.placeholder
                      ? { backgroundImage: `url("${plant.image.placeholder}")` }
                      : undefined
                  }
                />
                <span className="search__name">{plant.common_name}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
