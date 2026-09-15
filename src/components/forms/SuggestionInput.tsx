import React, { useState, useEffect, useRef } from 'react'
import { Sparkles, Check } from 'lucide-react'

interface SuggestionInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  suggestions?: string[]
  onSelectSuggestion?: (val: string) => void
}

export function SuggestionInput({
  suggestions = [],
  value = '',
  onChange,
  onSelectSuggestion,
  className = 'form-input',
  ...props
}: SuggestionInputProps) {
  const [isOpen, setIsOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const currentVal = String(value || '')
  
  // Filter suggestions matching current input text
  const filteredSuggestions = suggestions
    .filter(s => s && s.trim().length > 0)
    .filter(s => s.toLowerCase() !== currentVal.toLowerCase())
    .filter(s => !currentVal || s.toLowerCase().includes(currentVal.toLowerCase()))
    .slice(0, 8)

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
    if (onSelectSuggestion) {
      onSelectSuggestion(s)
    } else if (onChange) {
      const syntheticEvent = {
        target: { value: s, name: props.name },
      } as React.ChangeEvent<HTMLInputElement>
      onChange(syntheticEvent)
    }
    setIsOpen(false)
  }

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <input
        {...props}
        value={value}
        onChange={onChange}
        onFocus={() => setIsOpen(true)}
        className={className}
        autoComplete="off"
      />

      {/* Autocomplete Dropdown List */}
      {filteredSuggestions.length > 0 && isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white rounded-xl border border-blue-200 shadow-lg p-2 animate-fade-in space-y-1">
          <div className="flex items-center justify-between text-[10px] font-bold text-blue-700 uppercase tracking-wider px-2 py-0.5 border-b border-slate-100">
            <span className="flex items-center gap-1">
              <Sparkles size={11} className="text-amber-500" /> Previous Suggestions
            </span>
            <span className="text-slate-400 font-normal">Click to select</span>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-0.5 pt-1 sidebar-scroll">
            {filteredSuggestions.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  handleSelect(item)
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-blue-50 text-slate-700 hover:text-blue-900 font-medium transition-colors flex items-center justify-between group"
              >
                <span className="truncate">{item}</span>
                <span className="text-[10px] font-semibold text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 flex-shrink-0 ml-2">
                  Select <Check size={10} />
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
