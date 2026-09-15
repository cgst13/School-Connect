import React, { useState, useEffect, useRef } from 'react'
import { Sparkles, Plus } from 'lucide-react'

interface SuggestionTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  suggestions?: string[]
  onSelectSuggestion?: (val: string) => void
}

export function SuggestionTextarea({
  suggestions = [],
  value = '',
  onChange,
  onSelectSuggestion,
  className = 'form-textarea min-h-[120px]',
  ...props
}: SuggestionTextareaProps) {
  const [isOpen, setIsOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const currentVal = String(value || '')

  const filteredSuggestions = suggestions
    .filter(s => s && s.trim().length > 0)
    .filter(s => !currentVal || !currentVal.includes(s))
    .slice(0, 5)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (s: string) => {
    const newText = currentVal.trim()
      ? `${currentVal.trim()}; ${s}`
      : s

    if (onSelectSuggestion) {
      onSelectSuggestion(newText)
    } else if (onChange) {
      const syntheticEvent = {
        target: { value: newText, name: props.name },
      } as React.ChangeEvent<HTMLTextAreaElement>
      onChange(syntheticEvent)
    }
    setIsOpen(false)
  }

  return (
    <div className="relative w-full space-y-2" ref={wrapperRef}>
      <textarea
        {...props}
        value={value}
        onChange={onChange}
        onFocus={() => setIsOpen(true)}
        className={className}
      />

      {/* Suggestion Badges below textarea */}
      {isOpen && filteredSuggestions.length > 0 && (
        <div className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
            <span className="flex items-center gap-1 text-blue-700">
              <Sparkles size={12} className="text-amber-500" /> Suggestions from previous records (click to add):
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {filteredSuggestions.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelect(item)}
                className="text-[11px] text-left font-medium bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-900 border border-slate-200 hover:border-blue-300 px-2.5 py-1 rounded-lg shadow-2xs transition-all flex items-center gap-1 group max-w-full"
                title={`Click to add: "${item}"`}
              >
                <Plus size={11} className="text-blue-500 flex-shrink-0 group-hover:scale-125 transition-transform" />
                <span className="truncate">{item}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
