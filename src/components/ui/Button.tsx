import { ButtonHTMLAttributes, ReactNode, forwardRef } from 'react'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  icon?: ReactNode
  iconPosition?: 'left' | 'right'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      icon,
      iconPosition = 'left',
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    const variantClasses = {
      primary: 'bg-[#2563EB] text-white hover:bg-[#1D4ED8] active:bg-[#1E40AF] border border-transparent shadow-2xs',
      secondary: 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:text-[#2563EB] hover:border-slate-300 shadow-2xs',
      danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-2xs',
      ghost: 'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900',
    }

    const sizeClasses = {
      sm: 'px-2.5 py-1 text-xs rounded-md gap-1.5 font-medium',
      md: 'px-3.5 py-1.5 text-xs font-semibold rounded-md gap-2',
      lg: 'px-4 py-2 text-sm font-bold rounded-md gap-2',
    }

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={`inline-flex items-center justify-center transition-all duration-150 select-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        {...props}
      >
        {icon && iconPosition === 'left' && <span className="flex-shrink-0">{icon}</span>}
        <span>{children}</span>
        {icon && iconPosition === 'right' && <span className="flex-shrink-0">{icon}</span>}
      </button>
    )
  }
)

Button.displayName = 'Button'

export function PrimaryButton(props: ButtonProps) {
  return <Button variant="primary" {...props} />
}

export function SecondaryButton(props: ButtonProps) {
  return <Button variant="secondary" {...props} />
}

export function DangerButton(props: ButtonProps) {
  return <Button variant="danger" {...props} />
}

export function ButtonGroup({ children }: { children: ReactNode }) {
  return <div className="inline-flex items-center gap-2">{children}</div>
}
