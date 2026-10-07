import { ReactNode } from 'react'
import { AlertTriangle, AlertCircle, Info, X, Loader2 } from 'lucide-react'
import { useGenieModal } from '@/utils/genieAnimation'

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
  const { shouldRender, triggerClose, containerClass, backdropClass } = useGenieModal(isOpen, onCancel)

  if (!shouldRender) return null

  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          iconBg: 'bg-rose-50 border-rose-200 text-rose-600',
          icon: <AlertTriangle size={20} className="text-rose-600" />,
          btn: 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs'
        }
      case 'warning':
        return {
          iconBg: 'bg-amber-50 border-amber-200 text-amber-700',
          icon: <AlertCircle size={20} className="text-amber-600" />,
          btn: 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs'
        }
      default:
        return {
          iconBg: 'bg-blue-50 border-blue-200 text-[#2563EB]',
          icon: <Info size={20} className="text-[#2563EB]" />,
          btn: 'bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow-xs'
        }
    }
  }

  const styles = getVariantStyles()

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs ${backdropClass}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
    >
      <div className="absolute inset-0" onClick={triggerClose} />

      <div className={`relative w-full max-w-md bg-white rounded-2xl p-6 shadow-xl border border-slate-200/80 space-y-4 overflow-hidden z-10 ${containerClass} font-sans`}>
        <button
          onClick={triggerClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg bg-white text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
          aria-label="Close dialog"
          disabled={isLoading}
        >
          <X size={16} />
        </button>

        <div className="flex items-start gap-3.5 pr-6">
          <div className={`w-11 h-11 rounded-xl border ${styles.iconBg} flex items-center justify-center shrink-0`}>
            {styles.icon}
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <h2 id="dialog-title" className="text-base font-bold text-slate-900 tracking-tight">
              {title}
            </h2>
            <div className="text-xs text-slate-600 mt-1 leading-relaxed font-normal">
              {message}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
          <button
            type="button"
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-all cursor-pointer disabled:opacity-50"
            onClick={triggerClose}
            disabled={isLoading}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5 ${styles.btn}`}
            onClick={onConfirm}
            disabled={isLoading}
          >
            <span>{isLoading ? 'Processing...' : confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

