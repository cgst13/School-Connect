import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle, Printer, Plus, FileSpreadsheet } from 'lucide-react'
import { PublicLayout } from '@/components/layouts/PublicLayout'
import { fetchSubmissionByReference } from '@/lib/supabase/queries'
import { OfficialTermcatTemplate } from '@/components/templates/OfficialTermcatTemplate'
import type { FullSubmissionFormData, TermcatSubmission } from '@/types'
import { format } from 'date-fns'

interface Props {
  referenceNumber: string
  formData?: FullSubmissionFormData
  onSubmitAnother?: () => void
}

export function SuccessPage({ referenceNumber, formData, onSubmitAnother }: Props) {
  const [submission, setSubmission] = useState<TermcatSubmission | null>(null)
  const [showOfficialTemplate, setShowOfficialTemplate] = useState(true)

  useEffect(() => {
    fetchSubmissionByReference(referenceNumber).then(setSubmission)
  }, [referenceNumber])

  const handlePrint = () => window.print()

  return (
    <PublicLayout>
      <div className="w-full px-4 sm:px-8 py-6 space-y-6">
        {/* Success Hero */}
        <div className="text-center no-print">
          <div className="flex justify-center mb-3">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center border border-emerald-200">
              <CheckCircle size={36} className="text-emerald-600" />
            </div>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Submission Successful!</h1>
          <p className="text-sm text-slate-500 mt-1">
            Your TERMCAT evaluation data has been successfully registered and logged in the system.
          </p>
        </div>

        {/* Reference Number Card */}
        <div className="card p-6 text-center border-emerald-300 bg-emerald-50/60 no-print">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Official Reference Number</p>
          <p className="text-3xl font-extrabold text-blue-900 font-mono tracking-wider">{referenceNumber}</p>
          <p className="text-xs text-slate-500 mt-1.5">Please keep this reference number for official verification.</p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row gap-3 no-print">
          <button
            onClick={handlePrint}
            className="btn-md btn-primary flex-1 font-bold"
            aria-label="Print official summary form"
          >
            <Printer size={16} /> Print Official DepEd Form
          </button>
          <button
            type="button"
            onClick={() => {
              if (onSubmitAnother) {
                onSubmitAnother()
              } else {
                window.location.href = '/submit?another=true'
              }
            }}
            className="btn-md btn-secondary flex-1 text-center font-bold"
          >
            <Plus size={16} /> Submit Another Form
          </button>
        </div>

        {/* Official DepEd Printable Form View */}
        {submission && (
          <div className="space-y-4">
            <div className="flex items-center justify-between no-print border-t border-slate-200 pt-4">
              <h2 className="section-title flex items-center gap-2">
                <FileSpreadsheet size={18} className="text-blue-600" /> Official Submitted Form View
              </h2>
            </div>

            <OfficialTermcatTemplate submission={submission} showPrintButton={false} />
          </div>
        )}

        {/* Note */}
        <p className="text-xs text-slate-400 text-center no-print pt-2">
          Department of Education · Division of Romblon · Concepcion District
        </p>
      </div>
    </PublicLayout>
  )
}
