/** Small line icons for the plant page. Stroke follows currentColor. */
const PATHS = {
  home: (
    <>
      <path d="M4 10.5 12 4l8 6.5" />
      <path d="M6 9v10h12V9" />
      <path d="M10 19v-5h4v5" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </>
  ),
  landscape: (
    <>
      <path d="M12 21v-6" />
      <path d="M12 15c-3.5 0-6-2.2-6-5.2C6 6.5 8.7 3 12 3s6 3.5 6 6.8c0 3-2.5 5.2-6 5.2Z" />
      <path d="M3 21h18" />
    </>
  ),
  pot: (
    <>
      <path d="M6 13h12l-1.6 7.2a1 1 0 0 1-1 .8H8.6a1 1 0 0 1-1-.8L6 13Z" />
      <path d="M12 13V8" />
      <path d="M12 9c0-3 2-5 5-5 0 3-2 5-5 5ZM12 10.5C12 8 10.3 6.5 7.5 6.5c0 2.5 1.7 4 4.5 4Z" />
    </>
  ),
  origin: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z" />
    </>
  ),
  water: <path d="M12 3.5c3.5 4.2 6 7.6 6 10.8a6 6 0 0 1-12 0c0-3.2 2.5-6.6 6-10.8Z" />,
  paw: (
    <>
      <path d="M12 12.5c-2.6 0-5 2.6-5 5 0 1.7 1.3 2.5 2.7 2.5 1 0 1.5-.5 2.3-.5s1.3.5 2.3.5c1.4 0 2.7-.8 2.7-2.5 0-2.4-2.4-5-5-5Z" />
      <ellipse cx="8" cy="7" rx="1.6" ry="2.2" />
      <ellipse cx="16" cy="7" rx="1.6" ry="2.2" />
      <ellipse cx="4.6" cy="11.5" rx="1.5" ry="1.9" />
      <ellipse cx="19.4" cy="11.5" rx="1.5" ry="1.9" />
    </>
  ),
  sparkle: (
    <>
      <path d="M12 3.5c.7 4.2 2.3 5.8 6.5 6.5-4.2.7-5.8 2.3-6.5 6.5-.7-4.2-2.3-5.8-6.5-6.5 4.2-.7 5.8-2.3 6.5-6.5Z" />
      <path d="M18.5 15.5c.3 1.6.9 2.2 2.5 2.5-1.6.3-2.2.9-2.5 2.5-.3-1.6-.9-2.2-2.5-2.5 1.6-.3 2.2-.9 2.5-2.5Z" />
    </>
  ),
}

export default function Icon({ name, className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  )
}
