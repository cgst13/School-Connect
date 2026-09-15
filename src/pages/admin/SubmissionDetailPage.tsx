import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { AdminLayout } from '@/components/layouts/AdminLayout'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog'
import { PageLoader } from '@/components/ui/EmptyState'
import { OfficialTermcatTemplate } from '@/components/templates/OfficialTermcatTemplate'
import {
  fetchSubmissionById, updateSubmissionStatus, deleteSubmission, unlockSubmission, insertAuditLog
} from '@/lib/supabase/queries'
import { useAuth } from '@/features/auth/useAuth'
import { useToast } from '@/hooks/useToast'
import type { TermcatSubmission } from '@/types'
import { getKeyStageLabel } from '@/utils/keyStage'
import { format } from 'date-fns'
import {
  ArrowLeft, CheckCircle, RotateCcw, Star, Trash2, Printer, Lock, Unlock, Pencil, FileSpreadsheet, LayoutList
} from 'lucide-react'

function DataRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex flex-col sm:flex-row sm:justify-between py-2.5 border-b border-surface-border last:border-0 gap-1">
      <span className="text-xs font-medium text-content-secondary uppercase tracking-wide">{label}</span>
      <span className="text-sm text-content-primary font-medium sm:text-right">{value ?? '—'}</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 bg-surface-soft border-b border-surface-border">
        <h3 className="section-title">{title}</h3>
      </div>
      <div className="px-4">{children}</div>
    </div>
  )
}

export function SubmissionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { admin } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [submission, setSubmission] = useState<TermcatSubmission | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [viewMode, setViewMode] = useState<'cards' | 'official_template'>('official_template')

  // Dialog states
  const [dialog, setDialog] = useState<{
    open: boolean; type: 'review' | 'return' | 'finalize' | 'delete' | 'unlock' | null
    returnReason?: string
  }>({ open: false, type: null })

  const load = useCallback(() => {
    if (!id) return
    setLoading(true)
    fetchSubmissionById(id).then(setSubmission).finally(() => setLoading(false))
  }, [id])

  useEffect(() => { load() }, [load])

  const handleAction = async () => {
    if (!submission || !admin || !dialog.type) return
    setActionLoading(true)
    try {
      if (dialog.type === 'delete') {
        await deleteSubmission(submission.id)
        await insertAuditLog({ admin_id: admin.id, admin_name: admin.full_name, action: 'delete_submission', entity_type: 'submission', entity_id: submission.id, entity_label: submission.reference_number })
        toast('Submission deleted.', 'success')
        navigate('/admin/submissions')
        return
      }
      if (dialog.type === 'unlock') {
        await unlockSubmission(submission.id)
        await insertAuditLog({ admin_id: admin.id, admin_name: admin.full_name, action: 'unlock_submission', entity_type: 'submission', entity_id: submission.id, entity_label: submission.reference_number })
        toast('Submission unlocked.', 'success')
        load()
        setDialog({ open: false, type: null })
        return
      }
      await updateSubmissionStatus(submission.id, dialog.type as any, admin.id, dialog.returnReason)
      await insertAuditLog({
        admin_id: admin.id, admin_name: admin.full_name,
        action: `${dialog.type}_submission`,
        entity_type: 'submission', entity_id: submission.id, entity_label: submission.reference_number,
        details: dialog.returnReason ? { reason: dialog.returnReason } : undefined,
      })
      toast(`Submission ${dialog.type === 'review' ? 'marked as reviewed' : dialog.type === 'return' ? 'returned' : 'finalized'}.`, 'success')
      load()
    } catch {
      toast('Action failed. Please try again.', 'error')
    } finally {
      setActionLoading(false)
      setDialog({ open: false, type: null })
    }
  }

  if (loading) return <AdminLayout><PageLoader /></AdminLayout>
  if (!submission) return <AdminLayout><div className="card p-8 text-center"><p>Submission not found.</p></div></AdminLayout>

  const isKS1 = submission.form_type === 'ks1'
  const sc = submission.submission_competencies || []
  const mostLearned = sc.filter(c => c.category === 'most_learned').sort((a, b) => a.rank - b.rank)
  const leastMastered = sc.filter(c => c.category === 'least_mastered').sort((a, b) => a.rank - b.rank)
  const mostDifficult = sc.filter(c => c.category === 'most_difficult_to_teach').sort((a, b) => a.rank - b.rank)

  return (
    <AdminLayout>
      <div className="w-full space-y-4">
        {/* Back + Actions Header */}
        <div className="flex items-center gap-3 flex-wrap no-print">
          <Link to="/admin/submissions" className="btn-sm btn-secondary">
            <ArrowLeft size={14} /> Back
          </Link>
          
          {/* View mode switcher */}
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-100">
            <button
              onClick={() => setViewMode('official_template')}
              className={`btn-sm ${viewMode === 'official_template' ? 'btn-primary shadow-xs' : 'btn-ghost text-slate-600'}`}
            >
              <FileSpreadsheet size={14} /> Official DepEd Template
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`btn-sm ${viewMode === 'cards' ? 'btn-primary shadow-xs' : 'btn-ghost text-slate-600'}`}
            >
              <LayoutList size={14} /> Overview Cards
            </button>
          </div>

          <div className="flex-1" />

          {/* Actions based on status */}
          {!submission.is_locked && submission.status === 'submitted' && (
            <button className="btn-sm bg-amber-500 text-white hover:bg-amber-600" onClick={() => setDialog({ open: true, type: 'review' })}>
              <CheckCircle size={14} /> Mark Reviewed
            </button>
          )}
          {!submission.is_locked && submission.status === 'reviewed' && (
            <>
              <button className="btn-sm btn-success" onClick={() => setDialog({ open: true, type: 'finalize' })}>
                <Star size={14} /> Finalize
              </button>
              <button className="btn-sm btn-danger" onClick={() => setDialog({ open: true, type: 'return' })}>
                <RotateCcw size={14} /> Return
              </button>
            </>
          )}
          {submission.is_locked && (
            <button className="btn-sm btn-secondary" onClick={() => setDialog({ open: true, type: 'unlock' })}>
              <Unlock size={14} /> Unlock
            </button>
          )}
          {!submission.is_locked && (
            <Link to={`/admin/submissions/${submission.id}/edit`} className="btn-sm btn-secondary">
              <Pencil size={14} /> Edit
            </Link>
          )}
          <button className="btn-sm btn-danger" onClick={() => setDialog({ open: true, type: 'delete' })}>
            <Trash2 size={14} />
          </button>
          <button className="btn-sm btn-primary no-print" onClick={() => window.print()}>
            <Printer size={14} /> Print Form
          </button>
        </div>

        {/* Status + Reference Bar */}
        <div className="card p-4 flex items-center justify-between gap-4 flex-wrap no-print">
          <div>
            <p className="text-xs text-content-secondary mb-1">Reference Number</p>
            <p className="text-xl font-bold font-mono text-deped-blue">{submission.reference_number}</p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={submission.status} />
            {submission.is_locked && (
              <span className="badge bg-surface-soft text-content-secondary">
                <Lock size={12} /> Locked
              </span>
            )}
          </div>
        </div>

        {/* Main Content Area */}
        {viewMode === 'official_template' ? (
          <OfficialTermcatTemplate submission={submission} showPrintButton={false} />
        ) : (
          <div className="space-y-4">
            {/* Teacher Info */}
            <Section title="Teacher Information">
              <DataRow label="Teacher Name" value={submission.teacher_name} />
              <DataRow label="School" value={submission.school?.name} />
              <DataRow label="Grade Level" value={submission.grade_level?.name} />
              <DataRow label="Key Stage" value={getKeyStageLabel(submission.key_stage)} />
              <DataRow label="Learning Area" value={submission.learning_area?.name} />
              <DataRow label="School Year" value={submission.school_year?.name} />
              <DataRow label="Term" value={submission.term?.name} />
            </Section>

            {/* Submission Meta */}
            <Section title="Submission Information">
              <DataRow label="Date Submitted" value={format(new Date(submission.submitted_at), 'MMMM d, yyyy h:mm a')} />
              {submission.reviewed_at && <DataRow label="Date Reviewed" value={format(new Date(submission.reviewed_at), 'MMMM d, yyyy h:mm a')} />}
              {submission.finalized_at && <DataRow label="Date Finalized" value={format(new Date(submission.finalized_at), 'MMMM d, yyyy h:mm a')} />}
              {submission.returned_at && <DataRow label="Date Returned" value={format(new Date(submission.returned_at), 'MMMM d, yyyy h:mm a')} />}
              {submission.return_reason && <DataRow label="Return Reason" value={submission.return_reason} />}
              {submission.last_edited_at && <DataRow label="Last Edited" value={format(new Date(submission.last_edited_at), 'MMMM d, yyyy h:mm a')} />}
            </Section>

            {/* Learner Data */}
            <Section title={isKS1 ? 'Key Stage 1 — Learner Data' : 'Learner & Assessment Data'}>
              {isKS1 && submission.ks1_learner_data ? (
                <>
                  <DataRow label="Total Learners" value={submission.ks1_learner_data.total_learners} />
                  <DataRow label="Advancing" value={submission.ks1_learner_data.advancing} />
                  <DataRow label="Benchmarking" value={submission.ks1_learner_data.benchmarking} />
                  <DataRow label="Connecting" value={submission.ks1_learner_data.connecting} />
                  <DataRow label="Developing" value={submission.ks1_learner_data.developing} />
                  <DataRow label="Emerging" value={submission.ks1_learner_data.emerging} />
                </>
              ) : submission.ks2to4_learner_data ? (
                <>
                  <DataRow label="Total Learners" value={submission.ks2to4_learner_data.total_learners} />
                  <DataRow label="MPS" value={submission.ks2to4_learner_data.mps !== null ? `${submission.ks2to4_learner_data.mps}%` : '—'} />
                </>
              ) : <p className="py-3 text-sm text-content-tertiary">No learner data.</p>}
            </Section>

            {/* Competency Summary */}
            {submission.competency_summary && (
              <Section title="Competency Summary">
                <DataRow label="Total Intended" value={submission.competency_summary.total_intended_competencies} />
                <DataRow label="Taught" value={submission.competency_summary.competencies_taught} />
                <DataRow label="Not Taught" value={submission.competency_summary.competencies_not_taught} />
                <DataRow label="Reasons for Untaught" value={submission.competency_summary.reasons_for_untaught} />
              </Section>
            )}

            {/* Top Competencies */}
            {sc.length > 0 && (
              <Section title="Competency Analysis">
                <div className="py-3 space-y-4">
                  {[
                    { label: 'Top 5 Most Learned', items: mostLearned },
                    { label: 'Top 5 Least Mastered', items: leastMastered },
                    { label: 'Top 5 Most Difficult to Teach', items: mostDifficult },
                  ].map(({ label, items }) => (
                    <div key={label}>
                      <p className="text-xs font-semibold text-content-secondary uppercase tracking-wide mb-2">{label}</p>
                      {items.length > 0 ? (
                        <ol className="space-y-1">
                          {items.map(c => (
                            <li key={c.id} className="text-sm text-content-primary flex gap-2">
                              <span className="text-content-tertiary">{c.rank}.</span>
                              {c.competency_text}
                            </li>
                          ))}
                        </ol>
                      ) : <p className="text-sm text-content-tertiary">—</p>}
                    </div>
                  ))}
                  {submission.instructional_difficulty && (
                    <div>
                      <p className="text-xs font-semibold text-content-secondary uppercase tracking-wide mb-2">Instructional Difficulty Factors</p>
                      <p className="text-sm text-content-primary whitespace-pre-wrap">{submission.instructional_difficulty.factors_text || '—'}</p>
                    </div>
                  )}
                </div>
              </Section>
            )}
          </div>
        )}

        {/* Dialogs */}
        <ConfirmationDialog
          isOpen={dialog.open && dialog.type === 'review'}
          title="Mark as Reviewed"
          message="Are you sure you want to mark this submission as reviewed?"
          confirmLabel="Mark Reviewed"
          onConfirm={handleAction}
          onCancel={() => setDialog({ open: false, type: null })}
          isLoading={actionLoading}
        />
        <ConfirmationDialog
          isOpen={dialog.open && dialog.type === 'finalize'}
          title="Finalize Submission"
          message="Finalizing will lock this submission. Only an explicit unlock action can allow edits. Continue?"
          confirmLabel="Finalize"
          onConfirm={handleAction}
          onCancel={() => setDialog({ open: false, type: null })}
          isLoading={actionLoading}
        />
        <ConfirmationDialog
          isOpen={dialog.open && dialog.type === 'delete'}
          title="Delete Submission"
          message="This action cannot be undone. Are you sure you want to permanently delete this submission?"
          confirmLabel="Delete"
          variant="danger"
          onConfirm={handleAction}
          onCancel={() => setDialog({ open: false, type: null })}
          isLoading={actionLoading}
        />
        <ConfirmationDialog
          isOpen={dialog.open && dialog.type === 'unlock'}
          title="Unlock Submission"
          message="This will allow the submission to be edited. Continue?"
          confirmLabel="Unlock"
          variant="warning"
          onConfirm={handleAction}
          onCancel={() => setDialog({ open: false, type: null })}
          isLoading={actionLoading}
        />

        {/* Return Dialog (with reason input) */}
        {dialog.open && dialog.type === 'return' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-content-primary/20 backdrop-blur-sm" onClick={() => setDialog({ open: false, type: null })} />
            <div className="relative card-md w-full max-w-sm p-6 animate-slide-up space-y-4">
              <h2 className="text-base font-semibold text-content-primary">Return Submission</h2>
              <p className="text-sm text-content-secondary">Please provide a reason for returning this submission.</p>
              <textarea
                className="form-textarea min-h-[100px]"
                placeholder="e.g., Please correct the number of learners under Developing..."
                value={dialog.returnReason || ''}
                onChange={e => setDialog(d => ({ ...d, returnReason: e.target.value }))}
              />
              {(!dialog.returnReason || dialog.returnReason.length < 10) && (
                <p className="text-xs text-content-tertiary">Minimum 10 characters required.</p>
              )}
              <div className="flex gap-2 justify-end">
                <button className="btn-md btn-secondary" onClick={() => setDialog({ open: false, type: null })}>Cancel</button>
                <button
                  className="btn-md btn-danger"
                  onClick={handleAction}
                  disabled={!dialog.returnReason || dialog.returnReason.length < 10 || actionLoading}
                >
                  {actionLoading ? 'Returning...' : 'Return Submission'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
