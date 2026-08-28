export default function Leaf({ className = 'leaf' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M40 8C40 8 38 30 26 38C18 43.3 10 40 10 40C10 40 12 18 24 10C32 4.7 40 8 40 8Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M34 14C34 14 20 24 8 44" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
