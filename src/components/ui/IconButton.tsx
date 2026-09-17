import { ReactNode, ButtonHTMLAttributes } from 'react'

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode
  'aria-label': string
  tooltip?: string
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
  size?: 'sm' | 'md' | 'lg'
}

export function IconButton({
  icon,
  'aria-label': ariaLabel,
  tooltip,
  variant = 'ghost',
  size = 'md',
  className = '',
  ...props
}: IconButtonProps) {
  const sizeStyles = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-11 h-11 text-base',
  }

  const variantStyles = {
    primary: 'bg-[#6675E8] text-white hover:bg-[#5463DA] shadow-xs active:scale-95',
    secondary: 'bg-white text-[#1F2937] border border-[#E8EAF0] hover:bg-[#EEF0FF] hover:border-[#BFD7FF] hover:text-[#6675E8] shadow-xs active:scale-95',
    ghost: 'text-[#64748B] hover:bg-[#EEF0FF] hover:text-[#6675E8] active:scale-95',
    danger: 'bg-[#FFF0F5] text-[#992B54] border border-[#F7C7D9] hover:bg-[#F7C7D9] active:scale-95',
    success: 'bg-[#F0FAF5] text-[#1E6B48] border border-[#BFE8D5] hover:bg-[#BFE8D5] active:scale-95',
  }

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title={tooltip || ariaLabel}
      className={`inline-flex items-center justify-center rounded-xl transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6675E8]/40 disabled:opacity-40 disabled:pointer-events-none cursor-pointer ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {icon}
    </button>
  )
}
