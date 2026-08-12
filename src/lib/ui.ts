export const buttonBase =
  'inline-flex min-h-11 items-center justify-center gap-[9px] rounded-sm border px-[18px] font-semibold transition-[background,border-color,transform] duration-150 active:not-disabled:translate-y-px'

export const buttonPrimary =
  `${buttonBase} border-transparent bg-primary text-white hover:not-disabled:bg-primary-hover`

export const buttonSecondary =
  `${buttonBase} border-border bg-surface text-text hover:not-disabled:border-[#aebcaf] hover:not-disabled:bg-surface-soft`

export const buttonDanger =
  `${buttonBase} border-transparent bg-danger text-white hover:not-disabled:bg-[#921b13]`

export const buttonSmall = 'min-h-[38px] px-3.5 text-[13px]'

export const buttonFull = 'mt-1 min-h-12 w-full'

export const textButton =
  'border-0 bg-transparent p-0.5 font-bold text-primary hover:underline hover:underline-offset-3'

export const eyebrow =
  'm-0 mb-3 text-xs font-bold uppercase tracking-[0.13em] text-[#47705f]'

export const cardLabel =
  'm-0 mb-3.5 text-xs font-bold uppercase tracking-[0.1em] text-[#607066]'

export const panel =
  'rounded-lg border border-border bg-surface shadow-panel'

export const fieldInput =
  'h-12 w-full rounded-sm border border-border bg-surface px-3.5 text-text transition-[border-color,box-shadow] duration-150 placeholder:text-[#98a39c] hover:border-[#aebcaf] focus:border-focus focus:outline-none focus:ring-3 focus:ring-focus/15'

export const usernameInputShell =
  'flex h-[52px] items-center rounded-sm border border-border bg-surface transition-[border-color,box-shadow] duration-150 focus-within:border-focus focus-within:ring-3 focus-within:ring-focus/15'

export const usernameInput =
  'h-full min-w-0 flex-1 border-0 bg-transparent py-0 pr-3.5 pl-[3px] font-semibold text-text outline-none'

export const formError =
  '-mt-1 mb-[18px] flex items-center gap-2 text-sm text-danger'

export const formErrorIcon =
  'grid size-[18px] place-items-center rounded-full border border-current text-[11px] font-bold'

export const pageTopbar =
  'flex min-h-20 items-center justify-between gap-6 border-b border-border bg-white/85 px-4 py-4 backdrop-blur-xl min-[520px]:px-6 min-[1248px]:px-[calc((100vw-1200px)/2)] max-[480px]:min-h-[70px]'

export const avatar =
  'grid size-[38px] place-items-center rounded-full bg-primary font-bold text-[#f6fbf4] max-[480px]:hidden'
