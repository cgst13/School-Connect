import { Check, Sparkles, BookOpen, GraduationCap, Building, Pencil } from 'lucide-react'

interface Step {
  number: number
  label: string
}

export interface SelectedContext {
  gradeName?: string
  learningAreaName?: string
  schoolName?: string
  teacherName?: string
}

interface FormStepperProps {
  steps: Step[]
  currentStep: number
  selectedContext?: SelectedContext
  onEditStep1?: () => void
}

export function FormStepper({ steps, currentStep, selectedContext, onEditStep1 }: FormStepperProps) {
  return (
    <div className="w-full space-y-3">
      {/* Desktop / tablet */}
      <div className="hidden sm:flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = currentStep > step.number
          const isActive = currentStep === step.number
          const isLast = index === steps.length - 1

          return (
            <div key={step.number} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                    isCompleted
                      ? 'bg-deped-blue text-white'
                      : isActive
                      ? 'bg-deped-blue text-white ring-4 ring-deped-blue/20'
                      : 'bg-surface-soft text-content-tertiary border border-surface-border'
                  }`}
                  aria-current={isActive ? 'step' : undefined}
                >
                  {isCompleted ? <Check size={14} /> : step.number}
                </div>
                <span
                  className={`mt-1.5 text-xs font-medium whitespace-nowrap ${
                    isActive ? 'text-deped-blue' : isCompleted ? 'text-content-primary' : 'text-content-tertiary'
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {!isLast && (
                <div
                  className={`flex-1 h-0.5 mx-2 mb-5 transition-all ${
                    currentStep > step.number ? 'bg-deped-blue' : 'bg-surface-border'
                  }`}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Mobile: condensed */}
      <div className="sm:hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-deped-blue">
            Step {currentStep} of {steps.length}
          </span>
          <span className="text-sm text-content-secondary font-medium">
            {steps.find(s => s.number === currentStep)?.label}
          </span>
        </div>
        <div className="w-full bg-surface-soft rounded-full h-1.5">
          <div
            className="bg-deped-blue h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${(currentStep / steps.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Selected Grade & Learning Area Context Reminder Bar */}
      {selectedContext && (selectedContext.gradeName || selectedContext.learningAreaName) && (
        <div className="mt-3 pt-3 border-t border-slate-200/80 flex items-center justify-between gap-2.5 flex-wrap bg-gradient-to-r from-blue-50/90 via-slate-50 to-blue-50/40 p-3 rounded-xl border border-blue-200/80 animate-fade-in">
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="inline-flex items-center gap-1 font-bold text-blue-800 uppercase tracking-wider text-[11px] bg-blue-100/80 px-2.5 py-0.5 rounded-md border border-blue-200">
              <Sparkles size={12} className="text-amber-500" /> Filling out data for:
            </span>

            {selectedContext.gradeName && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white text-blue-900 font-extrabold border border-blue-200/80 shadow-2xs">
                <GraduationCap size={13} className="text-blue-600" />
                {selectedContext.gradeName}
              </span>
            )}

            {selectedContext.gradeName && selectedContext.learningAreaName && (
              <span className="text-slate-400 font-bold">•</span>
            )}

            {selectedContext.learningAreaName && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white text-blue-900 font-extrabold border border-blue-200/80 shadow-2xs">
                <BookOpen size={13} className="text-blue-600" />
                {selectedContext.learningAreaName}
              </span>
            )}

            {selectedContext.schoolName && (
              <>
                <span className="text-slate-300 font-bold hidden sm:inline">•</span>
                <span className="inline-flex items-center gap-1 text-slate-600 font-medium text-xs">
                  <Building size={12} className="text-slate-400" />
                  <span className="truncate max-w-[200px]" title={selectedContext.schoolName}>
                    {selectedContext.schoolName}
                  </span>
                </span>
              </>
            )}
          </div>

          {currentStep > 1 && onEditStep1 && (
            <button
              type="button"
              onClick={onEditStep1}
              className="text-[11px] font-bold text-blue-700 hover:text-blue-900 underline flex items-center gap-1 ml-auto transition-colors"
              title="Click to edit teacher info or change subject"
            >
              <Pencil size={11} /> Change Grade / Subject
            </button>
          )}
        </div>
      )}
    </div>
  )
}
