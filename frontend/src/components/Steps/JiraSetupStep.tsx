import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useWizard } from '../../contexts/WizardContext'
import { jiraApi } from '../../lib/api'
import type { Sprint, Epic, Task, Tester } from '../../types'
import Select from '../ui/Select'
import Button from '../ui/Button'
import Checkbox from '../ui/Checkbox'
import { ArrowLeft, ArrowRight, AlertCircle, MessageSquare } from 'lucide-react'
import clsx from 'clsx'

export default function JiraSetupStep() {
  const { state, dispatch, nextStep, prevStep, canProceedToStep } = useWizard()
  const [showEpicSection, setShowEpicSection] = useState(false)
  const [isAddingComments, setIsAddingComments] = useState(false)
  const [commentedTasks, setCommentedTasks] = useState<string[]>([])
  const [commentError, setCommentError] = useState<string | null>(null)

  const { data: sprintsData, isLoading: sprintsLoading, error: sprintsError } = useQuery({
    queryKey: ['sprints'],
    queryFn: () => jiraApi.getSprints(),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

  const { data: labelsData, isLoading: labelsLoading, error: labelsError } = useQuery({
    queryKey: ['labels'],
    queryFn: () => jiraApi.getLabels(),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

  const { data: testersData, isLoading: testersLoading } = useQuery({
    queryKey: ['testers'],
    queryFn: () => jiraApi.getTesters(),
    staleTime: 5 * 60 * 1000,
  })

  const { data: epicsData, isLoading: epicsLoading, error: epicsError } = useQuery({
    queryKey: ['epics', state.selectedSprint?.id, state.selectedLabels],
    queryFn: () => jiraApi.getEpics(
      state.selectedSprint?.id?.toString(),
      state.selectedLabels.length > 0 ? state.selectedLabels : undefined
    ),
    enabled: showEpicSection,
    staleTime: 2 * 60 * 1000,
    retry: 1,
  })

  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks', state.selectedEpic?.key, state.selectedTester?.accountId],
    queryFn: () => jiraApi.getTasks(
      state.selectedEpic?.key,
      state.selectedTester?.accountId
    ),
    enabled: !!state.selectedEpic,
    staleTime: 2 * 60 * 1000,
  })

  const sprints = sprintsData?.sprints || []
  const labels = labelsData?.labels || []
  const testers = testersData?.testers || []
  const epics = epicsData?.epics || []
  const tasks = tasksData?.tasks || []

  const handleSprintChange = (value: string | string[] | null) => {
    const sprint = sprints.find((s: Sprint) => s.id.toString() === value) || null
    dispatch({ type: 'SET_SPRINT', payload: sprint })
  }

  const handleLabelsChange = (value: string | string[] | null) => {
    dispatch({ type: 'SET_LABELS', payload: (value as string[]) || [] })
  }

  const handleEpicChange = (value: string | string[] | null) => {
    const epic = epics.find((e: Epic) => e.key === value) || null
    dispatch({ type: 'SET_EPIC', payload: epic })
  }

  const handleTesterChange = (value: string | string[] | null) => {
    const tester = testers.find((t: Tester) => t.accountId === value) || null
    dispatch({ type: 'SET_TESTER', payload: tester })
  }

  const handleTaskToggle = (task: Task, checked: boolean) => {
    if (checked) {
      dispatch({ type: 'SET_TASKS', payload: [...state.selectedTasks, task] })
    } else {
      dispatch({ type: 'SET_TASKS', payload: state.selectedTasks.filter(t => t.key !== task.key) })
    }
  }

  const handleSelectAllTasks = () => {
    if (state.selectedTasks.length === tasks.length) {
      dispatch({ type: 'SET_TASKS', payload: [] })
    } else {
      dispatch({ type: 'SET_TASKS', payload: tasks })
    }
  }

  const handleContinue = async () => {
    setCommentError(null)
    
    // Find tasks with empty descriptions
    const tasksWithEmptyDescription = state.selectedTasks.filter(
      task => !task.description || task.description.trim() === ''
    )
    
    if (tasksWithEmptyDescription.length > 0) {
      setIsAddingComments(true)
      const newCommentedTasks: string[] = []
      
      try {
        // Add comments to tasks with empty descriptions
        for (const task of tasksWithEmptyDescription) {
          try {
            const mentions = task.assignee?.accountId ? [task.assignee.accountId] : []
            await jiraApi.addComment(
              task.key,
              'Could you please add a description with proper testing criteria?\ncc: @qa-team',
              mentions
            )
            newCommentedTasks.push(task.key)
          } catch (err) {
            console.error(`Failed to add comment to ${task.key}:`, err)
          }
        }
        
        setCommentedTasks(prev => [...prev, ...newCommentedTasks])
      } catch (err) {
        console.error('Error adding comments:', err)
        setCommentError('Some comments could not be added, but you can still proceed.')
      } finally {
        setIsAddingComments(false)
      }
    }
    
    // Proceed to next step regardless of comment success
    nextStep()
  }

  const hasFilters = state.selectedSprint || state.selectedLabels.length > 0
  const canProceed = canProceedToStep(2)
  
  // Count tasks with empty descriptions in selected tasks
  const emptyDescriptionCount = state.selectedTasks.filter(
    task => !task.description || task.description.trim() === ''
  ).length

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-xl font-semibold text-text-primary mb-2">
          Configure Jira Source
        </h2>
        <p className="text-text-tertiary">
          Select the sprint, labels, and epic to generate test cases from.
          Test cases will be created for the selected child tasks.
        </p>
      </div>

      <div className="space-y-6">
        {/* Sprint & Labels Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Sprint"
            placeholder="Select a sprint..."
            searchable
            loading={sprintsLoading}
            error={sprintsError ? `Error loading sprints: ${(sprintsError as Error).message}` : undefined}
            options={sprints.map((s: Sprint) => ({
              value: s.id.toString(),
              label: s.name,
              description: s.state,
            }))}
            value={state.selectedSprint?.id?.toString() || null}
            onChange={handleSprintChange}
          />

          <Select
            label="Labels"
            placeholder="Select labels..."
            searchable
            multiple
            loading={labelsLoading}
            error={labelsError ? `Error loading labels: ${(labelsError as Error).message}` : undefined}
            options={labels.map((l: string) => ({
              value: l,
              label: l,
            }))}
            value={state.selectedLabels}
            onChange={handleLabelsChange}
          />
        </div>

        {/* Show Epic Section Button */}
        {!showEpicSection && (
          <div className="flex justify-center">
            <Button
              variant="secondary"
              onClick={() => setShowEpicSection(true)}
            >
              {hasFilters ? 'Load Filtered Epics' : 'Load All Epics'}
            </Button>
          </div>
        )}

        {/* Epic & Tester Selection */}
        {showEpicSection && (
          <div className="p-6 bg-neutral-light-grey rounded-xl space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Epic"
                placeholder="Select an epic..."
                searchable
                loading={epicsLoading}
                error={epicsError ? `Error loading epics: ${(epicsError as Error).message}` : undefined}
                options={epics.map((e: Epic) => ({
                  value: e.key,
                  label: `${e.key}: ${e.summary}`,
                  description: e.status,
                }))}
                value={state.selectedEpic?.key || null}
                onChange={handleEpicChange}
              />

              <Select
                label="Tester (Optional)"
                placeholder="Filter by tester..."
                searchable
                loading={testersLoading}
                options={testers.map((t: Tester) => ({
                  value: t.accountId,
                  label: t.displayName,
                  description: t.emailAddress,
                }))}
                value={state.selectedTester?.accountId || null}
                onChange={handleTesterChange}
              />
            </div>
          </div>
        )}

        {/* Tasks Selection */}
        {state.selectedEpic && (
          <div className="border border-neutral-grey rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-neutral-light-grey border-b border-neutral-grey flex items-center justify-between">
              <div>
                <h3 className="font-medium text-text-primary">
                  Child Tasks ({tasks.length})
                </h3>
                <p className="text-sm text-text-tertiary">
                  Select tasks to generate test cases for
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSelectAllTasks}
              >
                {state.selectedTasks.length === tasks.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>

            <div className="max-h-64 overflow-y-auto">
              {tasksLoading ? (
                <div className="px-4 py-8 text-center text-text-tertiary">
                  Loading tasks...
                </div>
              ) : tasks.length === 0 ? (
                <div className="px-4 py-8 text-center text-text-tertiary">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                  No tasks found for this epic
                </div>
              ) : (
                <div className="divide-y divide-neutral-lightest-grey">
                  {tasks.map((task: Task) => {
                    const hasEmptyDescription = !task.description || task.description.trim() === ''
                    const isSelected = state.selectedTasks.some(t => t.key === task.key)
                    const wasCommented = commentedTasks.includes(task.key)
                    
                    return (
                      <div
                        key={task.key}
                        className={clsx(
                          'px-4 py-3 hover:bg-neutral-light-grey transition-colors',
                          isSelected && 'bg-success-secondary/20'
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={isSelected}
                            onChange={(checked) => handleTaskToggle(task, checked)}
                            label={`${task.key}: ${task.summary}`}
                            description={`${task.type} • ${task.status}${task.assignee ? ` • ${task.assignee.displayName}` : ''}`}
                          />
                          {hasEmptyDescription && isSelected && (
                            <span 
                              className={clsx(
                                "flex-shrink-0 text-xs px-2 py-0.5 rounded-full mt-1",
                                wasCommented 
                                  ? "bg-blue-100 text-blue-700" 
                                  : "bg-warning-secondary text-warning-primary"
                              )}
                              title={wasCommented ? "Comment added requesting description" : "No description - comment will be added"}
                            >
                              {wasCommented ? (
                                <span className="flex items-center gap-1">
                                  <MessageSquare className="w-3 h-3" />
                                  Notified
                                </span>
                              ) : (
                                "No description"
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {state.selectedTasks.length > 0 && (
              <div className="px-4 py-3 bg-success-secondary/30 border-t border-success-primary/30">
                <p className="text-sm text-success-primary font-medium">
                  {state.selectedTasks.length} task{state.selectedTasks.length > 1 ? 's' : ''} selected
                </p>
              </div>
            )}
          </div>
        )}

        {/* Info Box */}
        <div className="p-4 bg-warning-secondary rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-warning-primary flex-shrink-0 mt-0.5" />
          <div className="text-sm text-text-secondary">
            <p className="font-medium text-warning-primary mb-1">Important Note</p>
            <p>
              Test cases are generated for child tasks, not the Epic itself. 
              The Epic is analyzed for context, but test cases are attributed to individual tasks.
            </p>
          </div>
        </div>

        {/* Empty Description Warning */}
        {emptyDescriptionCount > 0 && state.selectedTasks.length > 0 && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
            <MessageSquare className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-text-secondary">
              <p className="font-medium text-blue-700 mb-1">
                {emptyDescriptionCount} task{emptyDescriptionCount > 1 ? 's' : ''} without description
              </p>
              <p>
                When you continue, a comment will be added to each task asking the assignee to add a description with proper testing criteria.
              </p>
            </div>
          </div>
        )}

        {/* Comment Error */}
        {commentError && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-700">
              {commentError}
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="mt-8 flex justify-between">
        <Button variant="outline" onClick={prevStep} icon={<ArrowLeft className="w-4 h-4" />}>
          Back
        </Button>
        <Button
          onClick={handleContinue}
          disabled={!canProceed || isAddingComments}
          loading={isAddingComments}
          icon={<ArrowRight className="w-4 h-4" />}
        >
          {isAddingComments ? 'Adding Comments...' : 'Continue to Sheet Config'}
        </Button>
      </div>
    </div>
  )
}
