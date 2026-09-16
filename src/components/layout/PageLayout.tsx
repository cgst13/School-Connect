import { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

export function PageContainer({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`space-y-6 max-w-full mx-auto sc-animate-entrance ${className}`}>
      {children}
    </div>
  )
}

export function PageHeader({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 ${className}`}>
      {children}
    </div>
  )
}

export function PageTitle({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <h1 className={`text-xl sm:text-2xl font-black text-[#111827] tracking-tight ${className}`}>
      {children}
    </h1>
  )
}

export function PageDescription({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <p className={`text-xs text-[#64748B] mt-1 leading-relaxed ${className}`}>
      {children}
    </p>
  )
}

export function Breadcrumbs() {
  const location = useLocation()
  const pathParts = location.pathname.split('/').filter(Boolean)

  if (pathParts.length === 0) return null

  return (
    <nav className="flex items-center gap-1.5 text-xs text-[#64748B] font-medium mb-2">
      <Link to="/portal" className="hover:text-[#0B1F3A] transition-colors">
        School Connect
      </Link>
      {pathParts.map((part, index) => {
        const isLast = index === pathParts.length - 1
        return (
          <span key={part} className="flex items-center gap-1.5 capitalize">
            <ChevronRight size={12} className="text-slate-400" />
            <span className={isLast ? 'text-[#111827] font-semibold' : 'hover:text-[#0B1F3A]'}>
              {part.replace('-', ' ')}
            </span>
          </span>
        )
      })}
    </nav>
  )
}

export function Section({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl bg-white border border-[#E2E8F0] p-4 sm:p-6 shadow-xs ${className}`}>
      {children}
    </section>
  )
}

export function SectionHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 mb-4 pb-3 border-b border-[#E2E8F0]">
      <div>
        <h3 className="text-sm font-bold text-[#111827]">{title}</h3>
        {description && <p className="text-xs text-[#64748B] mt-0.5">{description}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}
