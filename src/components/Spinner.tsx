export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <span className="inline-flex" role="status">
      <span
        className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent"
        aria-hidden="true"
      />
      <span className="sr-only">{label}</span>
    </span>
  )
}
