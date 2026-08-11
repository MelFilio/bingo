import { useEffect, useRef } from 'react'
import { Spinner } from './Spinner'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  loading?: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  loading = false,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      className="confirm-dialog"
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
      <div className="confirm-dialog__icon" aria-hidden="true">!</div>
      <div className="confirm-dialog__copy">
        <h2 id="confirm-dialog-title">{title}</h2>
        <p id="confirm-dialog-description">{description}</p>
      </div>
      <div className="confirm-dialog__actions">
        <button
          className="button button--secondary"
          type="button"
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </button>
        <button
          className="button button--danger"
          type="button"
          onClick={onConfirm}
          disabled={loading}
        >
          {loading && <Spinner label="Closing room" />}
          {loading ? 'Closing room…' : confirmLabel}
        </button>
      </div>
    </dialog>
  )
}
