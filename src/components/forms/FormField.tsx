import { ReactNode } from 'react'

interface FormSectionProps {
  title: string
  description?: string
  children: ReactNode
  className?: string
}

export function FormSection({ title, description, children, className = '' }: FormSectionProps) {
  return (
    <div className={`space-y-4 ${className}`}>
      <div>
        <h3 className="section-title">{title}</h3>
        {description && <p className="text-sm text-content-secondary mt-0.5">{description}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

interface FormFieldProps {
  label: string
  error?: string
  hint?: string
  required?: boolean
  children: ReactNode
  id?: string
}

export function FormField({ label, error, hint, required, children, id }: FormFieldProps) {
  return (
    <div>
      <label className="form-label" htmlFor={id}>
        {label}
        {required && <span className="text-deped-red ml-0.5" aria-label="required">*</span>}
      </label>
      {children}
      {hint && !error && <p className="form-hint">{hint}</p>}
      {error && (
        <p className="form-error" role="alert" aria-live="polite">
          <span>⚠</span> {error}
        </p>
      )}
    </div>
  )
}

interface NumberFieldProps {
  id: string
  value: number | string
  onChange: (val: number) => void
  min?: number
  max?: number
  step?: number
  placeholder?: string
  disabled?: boolean
}

export function NumberField({ id, value, onChange, min = 0, max, step = 1, placeholder = '0', disabled }: NumberFieldProps) {
  return (
    <input
      id={id}
      type="number"
      inputMode="numeric"
      className="form-input"
      value={value === 0 ? '' : value}
      placeholder={placeholder}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onChange={e => {
        const n = parseFloat(e.target.value)
        onChange(isNaN(n) ? 0 : n)
      }}
    />
  )
}

interface DecimalFieldProps {
  id: string
  value: number | string | null
  onChange: (val: number | null) => void
  min?: number
  max?: number
  placeholder?: string
  disabled?: boolean
}

export function DecimalField({ id, value, onChange, min = 0, max = 100, placeholder = '0.00', disabled }: DecimalFieldProps) {
  return (
    <input
      id={id}
      type="number"
      inputMode="decimal"
      className="form-input"
      value={value === null || value === 0 ? '' : value}
      placeholder={placeholder}
      min={min}
      max={max}
      step="0.01"
      disabled={disabled}
      onChange={e => {
        const n = parseFloat(e.target.value)
        onChange(isNaN(n) ? null : n)
      }}
    />
  )
}
