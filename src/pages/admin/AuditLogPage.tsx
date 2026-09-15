import { useEffect, useState } from 'react'
import { AdminLayout } from '@/components/layouts/AdminLayout'
import { fetchAuditLogs } from '@/lib/supabase/queries'
import { Pagination } from '@/components/ui/Pagination'
import { TableSkeleton } from '@/components/ui/EmptyState'
import type { AuditLog } from '@/types'
import { format } from 'date-fns'
import { ScrollText } from 'lucide-react'

const PAGE_SIZE = 50

export function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchAuditLogs(page, PAGE_SIZE).then(({ data, count }) => {
      setLogs(data)
      setTotal(count)
    }).finally(() => setLoading(false))
  }, [page])

  const formatAction = (action: string) =>
    action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="page-title">Audit Log</h1>
          <span className="text-sm text-content-secondary">{total} entries</span>
        </div>

        <div className="card overflow-hidden">
          {loading ? (
            <TableSkeleton rows={10} cols={5} />
          ) : logs.length === 0 ? (
            <div className="p-12 text-center text-content-tertiary">
              <ScrollText size={32} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">No audit log entries yet.</p>
            </div>
          ) : (
            <>
              <div className="hidden md:block">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date / Time</th>
                      <th>Admin</th>
                      <th>Action</th>
                      <th>Entity</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(log => (
                      <tr key={log.id}>
                        <td className="text-xs text-content-secondary whitespace-nowrap">
                          {format(new Date(log.created_at), 'MMM d, yyyy h:mm a')}
                        </td>
                        <td className="text-sm">{log.admin_name || '—'}</td>
                        <td>
                          <span className="text-xs bg-deped-blue-light text-deped-blue px-2 py-0.5 rounded-full font-medium">
                            {formatAction(log.action)}
                          </span>
                        </td>
                        <td className="text-sm">
                          {log.entity_type && (
                            <span className="text-content-secondary capitalize">{log.entity_type}: </span>
                          )}
                          <span className="text-content-primary">{log.entity_label || log.entity_id || '—'}</span>
                        </td>
                        <td className="text-xs text-content-tertiary max-w-[200px] truncate">
                          {log.details ? JSON.stringify(log.details) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile */}
              <div className="md:hidden divide-y divide-surface-border">
                {logs.map(log => (
                  <div key={log.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-xs bg-deped-blue-light text-deped-blue px-2 py-0.5 rounded-full font-medium">
                          {formatAction(log.action)}
                        </span>
                        <p className="text-sm text-content-primary mt-1">{log.entity_label || log.entity_id || '—'}</p>
                        <p className="text-xs text-content-tertiary mt-0.5">{log.admin_name}</p>
                      </div>
                      <p className="text-xs text-content-tertiary whitespace-nowrap flex-shrink-0">
                        {format(new Date(log.created_at), 'MMM d, h:mm a')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
