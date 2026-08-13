import { useEffect, useRef } from 'react'
import { cn } from '../lib/styles'
import { Spinner } from './Spinner'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  loadingLabel?: string
  loading?: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  loadingLabel,
  loading = false,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const buttonBase =
    'inline-flex min-h-11 items-center justify-center gap-[9px] rounded-sm border px-[18px] font-semibold transition-[background,border-color,transform] duration-150 active:not-disabled:translate-y-px'

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      className="m-auto w-[min(calc(100%-32px),440px)] rounded-lg border border-border bg-surface p-0 text-text shadow-dialog backdrop:bg-[#0f1b148c] backdrop:backdrop-blur-[3px] open:animate-[dialog-in_180ms_cubic-bezier(.2,0,0,1)]"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-description"
      onCancel={(event) => {
        if (loading) {
          event.preventDefault()
          return
        }
        onCancel()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !loading) onCancel()
      }}
    >
      <div
        className="mt-7 ml-7 grid size-11 place-items-center rounded-full bg-[#feeceb] font-display font-extrabold text-danger"
        aria-hidden="true"
      >
        !
      </div>
      <div className="px-7 pt-5 pb-6">
        <h2
          className="m-0 font-display text-2xl tracking-normal"
          id="confirm-dialog-title"
        >
          {title}
        </h2>
        <p
          className="mt-2.5 mb-0 leading-[1.55] text-muted"
          id="confirm-dialog-description"
        >
          {description}
        </p>
      </div>
      <div className="flex justify-end gap-2.5 border-t border-border bg-[#fafcf9] px-7 py-[18px]">
        <button
          className={cn(
            buttonBase,
            'border-border bg-surface text-text hover:not-disabled:border-[#aebcaf] hover:not-disabled:bg-surface-soft',
          )}
          type="button"
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </button>
        <button
          className={cn(
            buttonBase,
            'border-transparent bg-danger text-white hover:not-disabled:bg-[#921b13]',
          )}
          type="button"
          onClick={onConfirm}
          disabled={loading}
        >
          {loading && <Spinner label={loadingLabel ?? confirmLabel} />}
          {loading ? `${loadingLabel ?? confirmLabel}…` : confirmLabel}
        </button>
      </div>
    </dialog>
  )
}
