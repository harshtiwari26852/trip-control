export default function Logo({ className = '' }) {
  return (
    <svg
      viewBox="0 0 132 26"
      className={className}
      fill="currentColor"
      role="img"
      aria-label="TripWise"
    >
      <text
        x="0"
        y="22"
        fontFamily="Figtree, ui-sans-serif, system-ui, sans-serif"
        fontWeight="700"
        fontSize="24"
        letterSpacing="-0.6"
      >
        TripWise
      </text>
    </svg>
  )
}