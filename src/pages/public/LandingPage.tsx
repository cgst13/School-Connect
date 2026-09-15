import { useNavigate } from 'react-router-dom'
import { ArrowRight, CheckCircle, Shield, Smartphone, ClipboardList } from 'lucide-react'
import { PublicLayout } from '@/components/layouts/PublicLayout'
import { hasDraft, loadDraft } from '@/lib/draft/draftManager'
import { useState } from 'react'

const features = [
  {
    icon: <Smartphone size={20} className="text-deped-blue" />,
    title: 'Mobile-Friendly',
    desc: 'Submit from any device — phone, tablet, or computer.',
  },
  {
    icon: <Shield size={20} className="text-deped-green" />,
    title: 'No Account Required',
    desc: 'Teachers submit directly without creating any account.',
  },
  {
    icon: <ClipboardList size={20} className="text-deped-gold" />,
    title: 'Auto-Save Draft',
    desc: 'Your progress is saved automatically even if you close the page.',
  },
]

export function LandingPage() {
  const navigate = useNavigate()
  const [showDraftPrompt, setShowDraftPrompt] = useState(hasDraft())

  const draft = loadDraft()

  const handleStart = () => {
    navigate('/submit')
  }

  const handleContinueDraft = () => {
    navigate('/submit?draft=true')
  }

  const handleNewSubmission = () => {
    setShowDraftPrompt(false)
    navigate('/submit?new=true')
  }

  return (
    <PublicLayout>
      <div className="max-w-4xl mx-auto px-4 py-10 sm:py-16">
        {/* Hero */}
        <div className="text-center mb-12">
          {/* Logo Mark */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-2xl bg-deped-blue flex items-center justify-center shadow-card-lg">
              <span className="text-white text-2xl font-extrabold tracking-tight">TC</span>
            </div>
          </div>

          {/* Branding */}
          <div className="mb-2">
            <span className="inline-block bg-deped-blue-light text-deped-blue text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider">
              Concepcion District · Romblon
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-content-primary mt-3 leading-tight">
            TERMCAT
          </h1>
          <p className="text-base sm:text-lg text-content-secondary font-medium mt-1">
            Teacher Data Collection & Consolidation System
          </p>
          <p className="text-sm text-content-tertiary mt-3 max-w-md mx-auto">
            Submit your TERMCAT data quickly and securely. No teacher account is required.
          </p>

          {/* Draft Prompt */}
          {showDraftPrompt && draft ? (
            <div className="mt-8 card p-5 max-w-md mx-auto border-deped-blue/30 bg-deped-blue-light text-left animate-fade-in">
              <div className="flex items-start gap-3">
                <CheckCircle size={20} className="text-deped-blue flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-deped-blue-dark">Saved Draft Found</p>
                  <p className="text-xs text-deped-blue-dark/70 mt-0.5">
                    Last saved: {new Date(draft.savedAt).toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={handleContinueDraft} className="btn-md btn-primary flex-1">
                  Continue Previous
                </button>
                <button onClick={handleNewSubmission} className="btn-md btn-secondary flex-1">
                  Start New
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <button
                id="start-submission-btn"
                onClick={handleStart}
                className="btn-lg btn-primary shadow-card-md"
                aria-label="Start TERMCAT submission"
              >
                Start Submission
                <ArrowRight size={18} aria-hidden="true" />
              </button>
            </div>
          )}

          <p className="text-xs text-content-tertiary mt-4">
            No teacher account is required.
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
          {features.map(f => (
            <div key={f.title} className="card p-5 text-center hover:shadow-card-md transition-shadow">
              <div className="w-10 h-10 rounded-xl bg-surface-soft flex items-center justify-center mx-auto mb-3">
                {f.icon}
              </div>
              <h3 className="text-sm font-semibold text-content-primary mb-1">{f.title}</h3>
              <p className="text-xs text-content-secondary leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Info */}
        <div className="card p-6 max-w-2xl mx-auto">
          <h2 className="text-sm font-semibold text-content-primary mb-3">How it works</h2>
          <ol className="space-y-2">
            {[
              'Enter your name, school, grade level, learning area, school year, and term.',
              'The system automatically determines your Key Stage and shows the correct form.',
              'Fill in the TERMCAT data for your class.',
              'Review your submission and submit.',
              'Receive a unique reference number for your records.',
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-content-secondary">
                <span className="w-5 h-5 rounded-full bg-deped-blue-light text-deped-blue text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </PublicLayout>
  )
}
