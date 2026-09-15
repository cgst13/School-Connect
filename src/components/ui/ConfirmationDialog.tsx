import { ReactNode } from 'react'
import { AlertTriangle, X } from 'lucide-react'

interface ConfirmationDialogProps {
  isOpen: boolean
  title: string
  message: string | ReactNode
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'default'
  isLoading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmationDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  isLoading,
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  if (!isOpen) return null

  const confirmClass =
    variant === 'danger'
      ? 'btn-md btn-danger'
      : variant === 'warning'
      ? 'btn-md bg-amber-500 text-white hover:bg-amber-600'
      : 'btn-md btn-primary'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-content-primary/20 backdrop-blur-sm" onClick={onCancel} />
      {/* Dialog */}
      <div className="relative card-md w-full max-w-sm p-6 animate-slide-up">
        <button
          onClick={onCancel}
          className="absolute top-3 right-3 text-content-tertiary hover:text-content-primary"
          aria-label="Close dialog"
        >
          <X size={18} />
        </button>
        <div className="flex items-start gap-3">
          {variant !== 'default' && (
            <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${variant === 'danger' ? 'bg-deped-red-light' : 'bg-deped-gold-light'}`}>
              <AlertTriangle size={20} className={variant === 'danger' ? 'text-deped-red' : 'text-deped-gold'} />
            </div>
          )}
          <div className="flex-1">
            <h2 id="dialog-title" className="text-base font-semibold text-content-primary">{title}</h2>
            <div className="text-sm text-content-secondary mt-1 leading-relaxed">{message}</div>
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-6">
          <button className="btn-md btn-secondary" onClick={onCancel} disabled={isLoading}>
            {cancelLabel}
          </button>
          <button className={confirmClass} onClick={onConfirm} disabled={isLoading}>
            {isLoading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
