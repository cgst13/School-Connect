import { ButtonHTMLAttributes, ReactNode, forwardRef } from 'react'
import { Tooltip } from './Tooltip'

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode
  'aria-label': string
  tooltip?: string
  tooltipPosition?: 'top' | 'bottom' | 'left' | 'right'
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      icon,
      'aria-label': ariaLabel,
      tooltip,
      tooltipPosition = 'top',
      variant = 'secondary',
      size = 'md',
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    const variantClasses = {
      primary: 'bg-[#0B1F3A] text-white hover:bg-[#07152A] active:scale-[0.97] border border-transparent shadow-xs',
      secondary: 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 active:scale-[0.97] shadow-xs',
      ghost: 'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:scale-[0.97]',
      danger: 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-600 hover:text-white active:scale-[0.97] shadow-xs',
    }

    const sizeClasses = {
      sm: 'p-1.5 text-xs rounded-md min-w-[28px] min-h-[28px]',
      md: 'p-2 text-sm rounded-lg min-w-[36px] min-h-[36px]',
      lg: 'p-2.5 text-base rounded-xl min-w-[44px] min-h-[44px]',
    }

    const buttonElement = (
      <button
        ref={ref}
        type="button"
        aria-label={ariaLabel}
        disabled={disabled}
        className={`inline-flex items-center justify-center font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B1F3A] focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none cursor-pointer ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        {...props}
      >
        {icon}
      </button>
    )

    if (tooltip) {
      return (
        <Tooltip content={tooltip} position={tooltipPosition}>
          {buttonElement}
        </Tooltip>
      )
    }

    return buttonElement
  }
)

IconButton.displayName = 'IconButton'
