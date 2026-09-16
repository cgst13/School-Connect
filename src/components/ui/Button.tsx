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
      primary: 'bg-[#0B1F3A] text-white hover:bg-[#07152A] active:scale-[0.98] border border-transparent shadow-xs',
      secondary: 'bg-white text-slate-800 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 active:scale-[0.98] shadow-xs',
      danger: 'bg-red-600 text-white hover:bg-red-700 active:scale-[0.98] shadow-xs',
      ghost: 'bg-transparent text-slate-700 hover:bg-slate-100 hover:text-slate-900 active:scale-[0.98]',
    }

    const sizeClasses = {
      sm: 'px-3 py-1.5 text-xs rounded-md gap-1.5 font-medium',
      md: 'px-4 py-2 text-xs font-semibold rounded-lg gap-2',
      lg: 'px-5 py-2.5 text-sm font-bold rounded-xl gap-2.5',
    }

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={`inline-flex items-center justify-center transition-all duration-150 select-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B1F3A] focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
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
