import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { useWizard } from '../../contexts/WizardContext'
import { generateApi } from '../../lib/api'
import type { GenerateRequest } from '../../lib/api'
import Select from '../ui/Select'
import Button from '../ui/Button'
import Input from '../ui/Input'
import { 
  ArrowLeft, 
  Play, 
  ExternalLink, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  Terminal,
  RefreshCw
} from 'lucide-react'
import clsx from 'clsx'
import {
  AI_PROVIDERS,
  STEP_CONTENT,
  LABELS,
  PLACEHOLDERS,
  BUTTONS,
  SUMMARY_LABELS,
  SUCCESS,
  ERRORS,
} from '../../constants'

export default function GenerateStep() {
  const { state, dispatch, prevStep } = useWizard()
  const [isGenerating, setIsGenerating] = useState(false)
  const logRef = useRef<HTMLDivElement>(null)

  const startMutation = useMutation({
    mutationFn: (data: GenerateRequest) => generateApi.start(data),
    onSuccess: (data) => {
      dispatch({ type: 'SET_GENERATION_JOB_ID', payload: data.job_id })
      startEventStream(data.job_id)
    },
    onError: (error: Error) => {
      toast.error(ERRORS.START_GENERATION_FAILED(error.message))
      setIsGenerating(false)
    },
  })

  const startEventStream = (jobId: string) => {
    const eventSource = new EventSource(generateApi.streamUrl(jobId), {
      withCredentials: true,
    })

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        
        if (data.type === 'message') {
          dispatch({ type: 'ADD_GENERATION_MESSAGE', payload: data.message })
        } else if (data.type === 'complete') {
          dispatch({ type: 'SET_GENERATION_RESULT', payload: data.result })
          setIsGenerating(false)
          eventSource.close()
          toast.success(SUCCESS.GENERATION_COMPLETE)
        } else if (data.type === 'error') {
          dispatch({ type: 'SET_GENERATION_ERROR', payload: data.error })
          setIsGenerating(false)
          eventSource.close()
          toast.error(ERRORS.GENERATION_FAILED)
        }
      } catch (e) {
        console.error('Failed to parse SSE message:', e)
      }
    }

    eventSource.onerror = () => {
      eventSource.close()
      if (isGenerating) {
        dispatch({ type: 'SET_GENERATION_ERROR', payload: ERRORS.CONNECTION_LOST })
        setIsGenerating(false)
      }
    }
  }

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [state.generationMessages])

  const handleStart = () => {
    if (!state.selectedEpic || !state.selectedSheet) return

    dispatch({ type: 'RESET_GENERATION' })
    setIsGenerating(true)

    const subsheetName = state.selectedSubsheet?.name || state.newSubsheetName

    const request: GenerateRequest = {
      epic_key: state.selectedEpic.key,
      task_keys: state.selectedTasks.map(t => t.key),
      sheet_id: state.selectedSheet.id,
      subsheet_name: subsheetName,
      columns: state.columns.filter(c => c.trim()),
      column_defaults: Object.keys(state.columnDefaults).length > 0 ? state.columnDefaults : undefined,
      ai_provider: state.aiProvider,
      ai_api_key: state.aiApiKey || undefined,
    }

    startMutation.mutate(request)
  }

  const handleReset = () => {
    dispatch({ type: 'RESET_GENERATION' })
  }

  const isComplete = !!state.generationResult
  const hasError = !!state.generationError

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-xl font-semibold text-text-primary mb-2">
          {STEP_CONTENT.GENERATE.TITLE}
        </h2>
        <p className="text-text-tertiary">
          {STEP_CONTENT.GENERATE.DESCRIPTION}
        </p>
      </div>

      <div className="space-y-6">
        {/* AI Configuration */}
        {!isGenerating && !isComplete && !hasError && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label={LABELS.AI_PROVIDER}
              options={[...AI_PROVIDERS]}
              value={state.aiProvider}
              onChange={(value) => dispatch({ type: 'SET_AI_PROVIDER', payload: value as 'anthropic' | 'openai' | 'gemini' })}
            />

            <Input
              label={LABELS.API_KEY}
              type="password"
              placeholder={PLACEHOLDERS.API_KEY_HINT}
              value={state.aiApiKey}
              onChange={(e) => dispatch({ type: 'SET_AI_API_KEY', payload: e.target.value })}
            />
          </div>
        )}

        {/* Summary */}
        <div className="p-4 bg-neutral-light-grey rounded-xl space-y-2">
          <h3 className="font-medium text-text-primary">{LABELS.GENERATION_SUMMARY}</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-text-tertiary">{SUMMARY_LABELS.EPIC}</span>{' '}
              <span className="text-text-primary">{state.selectedEpic?.key}</span>
            </div>
            <div>
              <span className="text-text-tertiary">{SUMMARY_LABELS.TASKS}</span>{' '}
              <span className="text-text-primary">{state.selectedTasks.length}</span>
            </div>
            <div>
              <span className="text-text-tertiary">{SUMMARY_LABELS.SHEET}</span>{' '}
              <span className="text-text-primary">{state.selectedSheet?.name}</span>
            </div>
            <div>
              <span className="text-text-tertiary">{SUMMARY_LABELS.TAB}</span>{' '}
              <span className="text-text-primary">
                {state.selectedSubsheet?.name || state.newSubsheetName}
              </span>
            </div>
          </div>
        </div>

        {/* Progress Log */}
        {(isGenerating || state.generationMessages.length > 0) && (
          <div className="border border-neutral-grey rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-neutral-light-grey border-b border-neutral-grey flex items-center gap-2">
              <Terminal className="w-4 h-4 text-text-tertiary" />
              <span className="font-medium text-text-primary">{LABELS.GENERATION_LOG}</span>
              {isGenerating && (
                <Loader2 className="w-4 h-4 text-success-primary animate-spin ml-auto" />
              )}
            </div>
            
            <div
              ref={logRef}
              className="h-64 overflow-y-auto p-4 bg-neutral-dark-grey font-mono text-sm"
            >
              {state.generationMessages.map((message, index) => (
                <div
                  key={index}
                  className={clsx(
                    'py-0.5',
                    message.includes('Error') || message.includes('error')
                      ? 'text-failure-primary'
                      : message.includes('✓') || message.includes('✅') || message.includes('Completed')
                      ? 'text-success-primary'
                      : 'text-neutral-grey'
                  )}
                >
                  {message}
                </div>
              ))}
              {isGenerating && (
                <div className="text-success-primary animate-pulse">▌</div>
              )}
            </div>
          </div>
        )}

        {/* Success State */}
        {isComplete && state.generationResult && (
          <div className="p-6 bg-success-secondary/30 rounded-xl border border-success-primary">
            <div className="flex items-start gap-4">
              <CheckCircle2 className="w-8 h-8 text-success-primary flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-text-primary text-lg mb-2">
                  {SUCCESS.GENERATION_COMPLETE_TITLE}
                </h3>
                <div className="space-y-1 text-sm text-text-secondary">
                  <p>
                    {SUCCESS.TEST_CASES_GENERATED(state.generationResult.test_cases_count)}
                  </p>
                  <p>
                    {SUCCESS.ROWS_WRITTEN(state.generationResult.rows_written, state.generationResult.tab_name)}
                  </p>
                </div>
                
                <div className="mt-4 flex gap-3">
                  <a
                    href={state.generationResult.sheet_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-success-primary text-white rounded-lg hover:bg-success-primary/90 transition-colors"
                  >
                    {BUTTONS.OPEN_SHEET}
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <Button variant="outline" onClick={handleReset} icon={<RefreshCw className="w-4 h-4" />}>
                    {BUTTONS.GENERATE_AGAIN}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error State */}
        {hasError && (
          <div className="p-6 bg-failure-secondary rounded-xl border border-failure-primary">
            <div className="flex items-start gap-4">
              <XCircle className="w-8 h-8 text-failure-primary flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-text-primary text-lg mb-2">
                  {ERRORS.GENERATION_FAILED_TITLE}
                </h3>
                <p className="text-sm text-text-secondary mb-4">
                  {state.generationError?.split('\n')[0]}
                </p>
                
                <Button variant="outline" onClick={handleReset} icon={<RefreshCw className="w-4 h-4" />}>
                  {BUTTONS.TRY_AGAIN}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-8 flex justify-between">
        <Button 
          variant="outline" 
          onClick={prevStep} 
          icon={<ArrowLeft className="w-4 h-4" />}
          disabled={isGenerating}
        >
          {BUTTONS.BACK}
        </Button>
        
        {!isComplete && !hasError && (
          <Button
            onClick={handleStart}
            loading={isGenerating}
            disabled={isGenerating}
            icon={!isGenerating ? <Play className="w-4 h-4" /> : undefined}
          >
            {isGenerating ? BUTTONS.GENERATING : BUTTONS.START_GENERATION}
          </Button>
        )}
      </div>
    </div>
  )
}
