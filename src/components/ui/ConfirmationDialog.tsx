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
          iconBg: 'from-[#FECACA] to-[#FCA5A5] text-[#B91C1C]',
          icon: <AlertTriangle size={22} className="text-[#B91C1C]" />,
          btn: 'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-md shadow-rose-500/30'
        }
      case 'warning':
        return {
          iconBg: 'from-[#FDE68A] to-[#FCD34D] text-[#B45309]',
          icon: <AlertCircle size={22} className="text-[#B45309]" />,
          btn: 'bg-gradient-to-r from-amber-500 to-yellow-600 text-white shadow-md shadow-amber-500/30'
        }
      default:
        return {
          iconBg: 'from-[#DDD6FE] to-[#C4B5FD] text-[#6D28D9]',
          icon: <Info size={22} className="text-[#6D28D9]" />,
          btn: 'bg-gradient-to-r from-[#7181F5] to-[#5463DA] text-white shadow-neu-btn'
        }
    }
  }

  const styles = getVariantStyles()

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2D2638]/40 backdrop-blur-md ${backdropClass}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
    >
      <div className="absolute inset-0" onClick={triggerClose} />

      <div className={`relative w-full max-w-md bg-[#FAF5F0] rounded-[36px] p-6 sm:p-8 shadow-[0_25px_60px_rgba(139,114,244,0.22)] border-4 border-white space-y-5 overflow-hidden z-10 ${containerClass}`}>
        <button
          onClick={triggerClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-white text-[#7A7289] hover:text-[#2D2638] shadow-2xs border border-white transition-all cursor-pointer active:scale-95"
          aria-label="Close dialog"
          disabled={isLoading}
        >
          <X size={16} />
        </button>

        <div className="flex items-start gap-4 pr-6">
          <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${styles.iconBg} flex items-center justify-center shrink-0 shadow-md border-2 border-white`}>
            {styles.icon}
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <h2 id="dialog-title" className="text-lg font-black text-[#2D2638] tracking-tight font-display">
              {title}
            </h2>
            <div className="text-xs sm:text-sm text-[#7A7289] mt-1.5 leading-relaxed font-semibold">
              {message}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#F0E6DD]">
          <button
            type="button"
            className="px-6 py-2.5 rounded-full text-xs font-black text-[#7A7289] bg-white hover:bg-[#F6EFFF] hover:text-[#2D2638] shadow-2xs border border-white transition-all cursor-pointer disabled:opacity-50 active:scale-95"
            onClick={triggerClose}
            disabled={isLoading}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`px-6 py-2.5 rounded-full text-xs font-black transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50 border border-white/40 active:animate-button-sparkle ${styles.btn}`}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading && <Loader2 size={14} className="animate-spin" />}
            {isLoading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
