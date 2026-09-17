export function SkeletonText({ className = 'h-4 w-full' }: { className?: string }) {
  return <div className={`bg-[#E8EAF0]/70 rounded-md animate-pulse ${className}`} />
}

export function SkeletonCard({ className = 'h-32 w-full' }: { className?: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-[#E8EAF0] p-5 space-y-3 animate-pulse shadow-xs ${className}`}>
      <div className="h-4 w-1/3 bg-[#E8EAF0]/70 rounded-md" />
      <div className="h-8 w-1/2 bg-[#E8EAF0]/90 rounded-lg" />
      <div className="h-3 w-2/3 bg-[#E8EAF0]/60 rounded-md" />
    </div>
  )
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="w-full rounded-2xl border border-[#E8EAF0] bg-white overflow-hidden space-y-3 p-4 animate-pulse">
      <div className="h-10 bg-[#FAFBFF] rounded-xl border border-[#E8EAF0]/60" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 bg-slate-50/70 rounded-lg border border-slate-100" />
      ))}
    </div>
  )
}

export function SkeletonDashboard() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <SkeletonTable rows={6} />
    </div>
  )
}
