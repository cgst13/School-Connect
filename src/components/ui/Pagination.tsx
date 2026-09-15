import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}

export function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const totalPages = Math.ceil(total / pageSize)
  if (totalPages <= 1) return null

  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-surface-border">
      <p className="text-sm text-content-secondary">
        Showing <span className="font-medium">{from}–{to}</span> of <span className="font-medium">{total}</span>
      </p>
      <div className="flex items-center gap-1">
        <button
          className="btn-ghost btn-sm rounded-md disabled:opacity-40"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft size={16} />
        </button>
        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
          let pageNum = i + 1
          if (totalPages > 5) {
            if (page <= 3) pageNum = i + 1
            else if (page >= totalPages - 2) pageNum = totalPages - 4 + i
            else pageNum = page - 2 + i
          }
          return (
            <button
              key={pageNum}
              className={`btn-sm rounded-md w-8 text-sm ${page === pageNum ? 'bg-deped-blue text-white' : 'btn-ghost'}`}
              onClick={() => onPageChange(pageNum)}
              aria-current={page === pageNum ? 'page' : undefined}
            >
              {pageNum}
            </button>
          )
        })}
        <button
          className="btn-ghost btn-sm rounded-md disabled:opacity-40"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}
