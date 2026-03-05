import { useWizard } from '../../contexts/WizardContext'
import { Check, User, Settings, FileText, Edit2 } from 'lucide-react'
import clsx from 'clsx'

export default function StepCards() {
  const { state, goToStep } = useWizard()

  const cards = [
    {
      step: 0,
      title: 'Authentication',
      icon: User,
      isComplete: state.authStatus?.google.authenticated && state.authStatus?.atlassian.authenticated,
      content: state.authStatus ? (
        <div className="space-y-1 text-sm">
          <div className="flex items-center gap-2">
            <span className={state.authStatus.google.authenticated ? 'text-success-primary' : 'text-text-tertiary'}>
              {state.authStatus.google.authenticated ? '✓' : '○'}
            </span>
            <span>Google: {state.authStatus.google.email || 'Not signed in'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={state.authStatus.atlassian.authenticated ? 'text-success-primary' : 'text-text-tertiary'}>
              {state.authStatus.atlassian.authenticated ? '✓' : '○'}
            </span>
            <span>Atlassian: {state.authStatus.atlassian.siteName || 'Not signed in'}</span>
          </div>
        </div>
      ) : null,
    },
    {
      step: 1,
      title: 'Jira Setup',
      icon: Settings,
      isComplete: state.selectedEpic && state.selectedTasks.length > 0,
      content: state.selectedEpic ? (
        <div className="space-y-1 text-sm">
          <p><span className="text-text-tertiary">Epic:</span> {state.selectedEpic.key}</p>
          <p><span className="text-text-tertiary">Tasks:</span> {state.selectedTasks.length} selected</p>
          {state.selectedSprint && (
            <p><span className="text-text-tertiary">Sprint:</span> {state.selectedSprint.name}</p>
          )}
        </div>
      ) : null,
    },
    {
      step: 2,
      title: 'Sheet Config',
      icon: FileText,
      isComplete: state.selectedSheet && (state.selectedSubsheet || state.newSubsheetName),
      content: state.selectedSheet ? (
        <div className="space-y-1 text-sm">
          <p className="truncate"><span className="text-text-tertiary">Sheet:</span> {state.selectedSheet.name}</p>
          <p><span className="text-text-tertiary">Tab:</span> {state.selectedSubsheet?.name || state.newSubsheetName || 'Not selected'}</p>
          <p><span className="text-text-tertiary">Columns:</span> {state.columns.length}</p>
        </div>
      ) : null,
    },
  ]

  const visibleCards = cards.filter(card => card.step < state.currentStep)

  if (visibleCards.length === 0) return null

  return (
    <div className="flex gap-4 flex-wrap">
      {visibleCards.map(card => {
        const Icon = card.icon
        return (
          <div
            key={card.step}
            className={clsx(
              'flex-1 min-w-[200px] max-w-[300px] rounded-lg border p-4 transition-all',
              card.isComplete
                ? 'border-success-primary bg-success-secondary/30'
                : 'border-neutral-grey bg-white'
            )}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div
                  className={clsx(
                    'w-8 h-8 rounded-full flex items-center justify-center',
                    card.isComplete ? 'bg-success-primary text-white' : 'bg-neutral-lightest-grey text-text-tertiary'
                  )}
                >
                  {card.isComplete ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </div>
                <span className="font-medium text-text-primary">{card.title}</span>
              </div>
              <button
                onClick={() => goToStep(card.step)}
                className="p-1.5 rounded-md hover:bg-neutral-lightest-grey text-text-tertiary hover:text-text-primary transition-colors"
                title="Edit"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            </div>
            <div className="text-text-secondary">
              {card.content || <span className="text-text-tertiary text-sm">Not configured</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
