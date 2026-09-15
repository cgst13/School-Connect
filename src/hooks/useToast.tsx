import { useState, useCallback, ReactNode } from 'react'
import { createContext, useContext } from 'react'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info' | 'warning'

interface Toast {
  id: string
  type: ToastType
  message: string
  duration?: number
}

interface ToastContextType {
  toasts: Toast[]
  toast: (message: string, type?: ToastType, duration?: number) => void
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((message: string, type: ToastType = 'success', duration = 4000) => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, type, message, duration }])
    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id))
      }, duration)
    }
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, toast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

const icons: Record<ToastType, ReactNode> = {
  success: <CheckCircle size={16} className="text-deped-green flex-shrink-0" />,
  error: <AlertCircle size={16} className="text-deped-red flex-shrink-0" />,
  info: <Info size={16} className="text-deped-blue flex-shrink-0" />,
  warning: <AlertTriangle size={16} className="text-deped-gold flex-shrink-0" />,
}

const borders: Record<ToastType, string> = {
  success: 'border-l-4 border-deped-green',
  error: 'border-l-4 border-deped-red',
  info: 'border-l-4 border-deped-blue',
  warning: 'border-l-4 border-deped-gold',
}

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
  if (toasts.length === 0) return null
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-full max-w-sm">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`card flex items-start gap-3 p-3.5 shadow-card-md animate-slide-up ${borders[t.type]}`}
          role="alert"
          aria-live="polite"
        >
          {icons[t.type]}
          <p className="text-sm text-content-primary flex-1 leading-snug">{t.message}</p>
          <button
            onClick={() => onRemove(t.id)}
            className="text-content-tertiary hover:text-content-primary flex-shrink-0 -mt-0.5"
            aria-label="Dismiss notification"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
