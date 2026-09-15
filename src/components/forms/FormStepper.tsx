import { Check } from 'lucide-react'

interface Step {
  number: number
  label: string
}

interface FormStepperProps {
  steps: Step[]
  currentStep: number
}

export function FormStepper({ steps, currentStep }: FormStepperProps) {
  return (
    <div className="w-full">
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
    </div>
  )
}
