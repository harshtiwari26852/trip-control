export function Field({ label, error, children }) {
  return (
    <label className="block">
      <span className="text-primary mb-1.5 block text-sm font-medium leading-none">
        {label}
      </span>
      {children}
      {error && (
        <span className="mt-1.5 block text-sm leading-none text-[#5c1a14]">
          {error}
        </span>
      )}
    </label>
  )
}

export function Input(props) {
  return (
    <input
      {...props}
      className="border-input text-foreground placeholder:text-muted-foreground h-12 w-full rounded-lg border bg-background px-4 text-base outline-none transition-shadow focus:border-ring focus:ring-3 focus:ring-ring/50"
    />
  )
}