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

  const toast = useCallback((message: string, type: ToastType = 'success', duration?: number) => {
    const defaultDuration = type === 'error' ? 10000 : 4000
    const finalDuration = duration !== undefined ? duration : defaultDuration
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, type, message, duration: finalDuration }])
    if (finalDuration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id))
      }, finalDuration)
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
  success: <CheckCircle size={18} className="text-deped-green flex-shrink-0 mt-0.5" />,
  error: <AlertCircle size={18} className="text-deped-red flex-shrink-0 mt-0.5" />,
  info: <Info size={18} className="text-deped-blue flex-shrink-0 mt-0.5" />,
  warning: <AlertTriangle size={18} className="text-deped-gold flex-shrink-0 mt-0.5" />,
}

const borders: Record<ToastType, string> = {
  success: 'border-l-4 border-deped-green bg-white/95',
  error: 'border-l-4 border-deped-red bg-red-50/95',
  info: 'border-l-4 border-deped-blue bg-white/95',
  warning: 'border-l-4 border-deped-gold bg-amber-50/95',
}

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
  if (toasts.length === 0) return null
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2.5 w-full max-w-md sm:max-w-xl px-2 sm:px-0">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`card flex items-start gap-3 p-4 shadow-xl rounded-2xl animate-slide-up border backdrop-blur-md ${borders[t.type]}`}
          role="alert"
          aria-live="polite"
        >
          {icons[t.type]}
          <div className="flex-1 min-w-0">
            <p className={`text-xs sm:text-sm text-content-primary leading-relaxed break-words ${t.type === 'error' ? 'font-mono text-red-950 font-medium' : ''}`}>
              {t.message}
            </p>
          </div>
          <button
            onClick={() => onRemove(t.id)}
            className="text-content-tertiary hover:text-content-primary flex-shrink-0 p-1 rounded-lg hover:bg-black/5 transition-colors"
            aria-label="Dismiss notification"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  )
}
