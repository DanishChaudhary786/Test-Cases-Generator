import { Check, User, Settings, FileText, Sparkles } from 'lucide-react'
import { useWizard } from '../../contexts/WizardContext'
import clsx from 'clsx'

interface Step {
  id: number
  title: string
  icon: string
}

interface StepperProps {
  steps: Step[]
  currentStep: number
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  user: User,
  settings: Settings,
  file: FileText,
  sparkles: Sparkles,
}

export default function Stepper({ steps, currentStep }: StepperProps) {
  const { canProceedToStep, goToStep } = useWizard()

  const getStepStatus = (stepId: number) => {
    if (stepId < currentStep) return 'completed'
    if (stepId === currentStep) return 'current'
    return 'upcoming'
  }

  return (
    <div className="flex items-center justify-center">
      {steps.map((step, index) => {
        const status = getStepStatus(step.id)
        const Icon = iconMap[step.icon] || User
        const isClickable = status === 'completed' || canProceedToStep(step.id)

        return (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center">
              <button
                onClick={() => isClickable && goToStep(step.id)}
                disabled={!isClickable}
                className={clsx(
                  'w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200',
                  {
                    'bg-success-primary text-white cursor-pointer hover:bg-success-primary/90': status === 'completed',
                    'bg-success-primary text-white ring-4 ring-success-secondary': status === 'current',
                    'bg-neutral-lightest-grey text-text-tertiary': status === 'upcoming' && !isClickable,
                    'bg-neutral-lightest-grey text-text-tertiary cursor-pointer hover:bg-neutral-grey': status === 'upcoming' && isClickable,
                  }
                )}
              >
                {status === 'completed' ? (
                  <Check className="w-6 h-6" />
                ) : (
                  <Icon className="w-6 h-6" />
                )}
              </button>
              <span
                className={clsx(
                  'mt-2 text-sm font-medium whitespace-nowrap',
                  {
                    'text-success-primary': status === 'completed',
                    'text-text-primary': status === 'current',
                    'text-text-tertiary': status === 'upcoming',
                  }
                )}
              >
                {step.title}
              </span>
            </div>

            {index < steps.length - 1 && (
              <div className="w-40 mx-4">
                <div
                  className={clsx(
                    'h-0.5 transition-colors duration-200',
                    {
                      'bg-success-primary': step.id < currentStep,
                      'bg-neutral-grey': step.id >= currentStep,
                    }
                  )}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
