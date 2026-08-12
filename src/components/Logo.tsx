export function Logo() {
  return (
    <div
      className="inline-flex items-center gap-2.5 font-display text-xl font-bold text-inherit"
      aria-label="Bingo home"
    >
      <span
        className="grid size-6 grid-cols-2 gap-[3px] rounded-[7px] bg-primary p-[3px]"
        aria-hidden="true"
      >
        <span className="rounded-[2px] bg-[#d8e7c7]" />
        <span className="rounded-[2px] bg-[#d8e7c7] opacity-55" />
        <span className="rounded-[2px] bg-[#d8e7c7] opacity-55" />
        <span className="rounded-[2px] bg-[#d8e7c7]" />
      </span>
      <span>Bingo</span>
    </div>
  )
}
