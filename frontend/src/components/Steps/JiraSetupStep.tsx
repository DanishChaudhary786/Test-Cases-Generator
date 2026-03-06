import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { useWizard } from '../../contexts/WizardContext'
import { jiraApi } from '../../lib/api'
import type { Sprint, Epic, Task, Tester } from '../../types'
import Select from '../ui/Select'
import Button from '../ui/Button'
import Checkbox from '../ui/Checkbox'
import Modal from '../ui/Modal'
import { ArrowLeft, ArrowRight, AlertCircle, MessageSquare } from 'lucide-react'
import clsx from 'clsx'

export default function JiraSetupStep() {
  const { state, dispatch, nextStep, prevStep, canProceedToStep } = useWizard()
  const [showEpicSection, setShowEpicSection] = useState(false)
  const [isAddingComments, setIsAddingComments] = useState(false)
  const [showEmptyDescriptionModal, setShowEmptyDescriptionModal] = useState(false)
  const [tasksWithEmptyDesc, setTasksWithEmptyDesc] = useState<Task[]>([])
  const [tasksToComment, setTasksToComment] = useState<string[]>([])

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

  const handleContinue = () => {
    // Find tasks with empty descriptions
    const emptyDescTasks = state.selectedTasks.filter(
      task => !task.description || task.description.trim() === ''
    )
    
    if (emptyDescTasks.length > 0) {
      // Show confirmation modal with all tasks selected by default
      setTasksWithEmptyDesc(emptyDescTasks)
      setTasksToComment(emptyDescTasks.map(t => t.key))
      setShowEmptyDescriptionModal(true)
    } else {
      // No empty descriptions, proceed directly
      nextStep()
    }
  }

  const handleTaskCommentToggle = (taskKey: string, checked: boolean) => {
    if (checked) {
      setTasksToComment(prev => [...prev, taskKey])
    } else {
      setTasksToComment(prev => prev.filter(key => key !== taskKey))
    }
  }

  const handleSelectAllForComment = () => {
    if (tasksToComment.length === tasksWithEmptyDesc.length) {
      setTasksToComment([])
    } else {
      setTasksToComment(tasksWithEmptyDesc.map(t => t.key))
    }
  }

  const handleAddCommentsAndContinue = async () => {
    setIsAddingComments(true)
    let successCount = 0
    
    // Get tasks that are selected for commenting
    const tasksToAddComment = tasksWithEmptyDesc.filter(task => tasksToComment.includes(task.key))
    
    try {
      // Add comments only to selected tasks
      for (const task of tasksToAddComment) {
        try {
          const mentions = task.assignee?.accountId ? [task.assignee.accountId] : []
          await jiraApi.addComment(
            task.key,
            'Could you please add a description with proper testing criteria?',
            mentions
          )
          successCount++
        } catch (err) {
          console.error(`Failed to add comment to ${task.key}:`, err)
        }
      }
      
      // Show success toast
      if (successCount > 0) {
        toast.success(
          `Comment added to ${successCount} task${successCount > 1 ? 's' : ''} requesting description`,
          { duration: 4000 }
        )
      }
    } catch (err) {
      console.error('Error adding comments:', err)
      toast.error('Some comments could not be added')
    } finally {
      setIsAddingComments(false)
    }
    
    // Deselect tasks without descriptions
    const tasksWithDescriptions = state.selectedTasks.filter(
      task => task.description && task.description.trim() !== ''
    )
    dispatch({ type: 'SET_TASKS', payload: tasksWithDescriptions })
    
    // Close modal (stay on current step)
    setShowEmptyDescriptionModal(false)
  }

  const handleSkipAndContinue = () => {
    // Deselect tasks without descriptions (don't add comments)
    const tasksWithDescriptions = state.selectedTasks.filter(
      task => task.description && task.description.trim() !== ''
    )
    dispatch({ type: 'SET_TASKS', payload: tasksWithDescriptions })
    
    // Close modal and proceed
    setShowEmptyDescriptionModal(false)
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
                              className="shrink-0 text-xs px-2 py-0.5 rounded-full mt-1 bg-warning-secondary text-warning-primary"
                              title="No description available"
                            >
                              No description
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
          <AlertCircle className="w-5 h-5 text-warning-primary shrink-0 mt-0.5" />
          <div className="text-sm text-text-secondary">
            <p className="font-medium text-warning-primary mb-1">Important Note</p>
            <p>
              Test cases are generated for child tasks, not the Epic itself. 
              The Epic is analyzed for context, but test cases are attributed to individual tasks.
            </p>
          </div>
        </div>

        {/* Empty Description Info */}
        {emptyDescriptionCount > 0 && state.selectedTasks.length > 0 && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm text-text-secondary">
              <p className="font-medium text-amber-700">
                {emptyDescriptionCount} of {state.selectedTasks.length} selected task{emptyDescriptionCount > 1 ? 's have' : ' has'} no description
              </p>
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
          disabled={!canProceed}
          icon={<ArrowRight className="w-4 h-4" />}
        >
          Continue to Sheet Config
        </Button>
      </div>

      {/* Empty Description Confirmation Modal */}
      <Modal
        isOpen={showEmptyDescriptionModal}
        onClose={() => setShowEmptyDescriptionModal(false)}
        title="Tasks Without Description"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-800">
                {tasksWithEmptyDesc.length} task{tasksWithEmptyDesc.length > 1 ? 's' : ''} without description
              </p>
              <p className="text-amber-700 mt-1">
                The following tasks don't have descriptions and will be deselected.
                Select which tasks should receive a comment:
              </p>
            </div>
          </div>

          <div className="border border-neutral-lightest-grey rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-neutral-light-grey border-b border-neutral-lightest-grey flex items-center justify-between">
              <span className="text-xs font-medium text-text-secondary">
                {tasksToComment.length} of {tasksWithEmptyDesc.length} selected for comment
              </span>
              <button
                type="button"
                onClick={handleSelectAllForComment}
                className="text-xs text-success-primary hover:underline"
              >
                {tasksToComment.length === tasksWithEmptyDesc.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            <div className="max-h-40 overflow-y-auto">
              {tasksWithEmptyDesc.map(task => (
                <div 
                  key={task.key} 
                  className={clsx(
                    "px-3 py-2 border-b border-neutral-lightest-grey last:border-b-0 transition-colors",
                    tasksToComment.includes(task.key) && "bg-success-secondary/10"
                  )}
                >
                  <Checkbox
                    checked={tasksToComment.includes(task.key)}
                    onChange={(checked) => handleTaskCommentToggle(task.key, checked)}
                    label={task.key}
                    description={task.summary}
                  />
                </div>
              ))}
            </div>
          </div>

          <p className="text-sm text-text-secondary">
            Comment will be added to selected tasks asking the assignee to add a description.
          </p>

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={handleSkipAndContinue}
              disabled={isAddingComments}
              className="flex-1"
            >
              Skip & Continue
            </Button>
            <Button
              variant="primary"
              onClick={handleAddCommentsAndContinue}
              loading={isAddingComments}
              disabled={isAddingComments || tasksToComment.length === 0}
              icon={<MessageSquare className="w-4 h-4" />}
              className="flex-1"
            >
              {isAddingComments ? 'Adding...' : `Add Comment${tasksToComment.length > 1 ? 's' : ''} & Deselect (${tasksToComment.length})`}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
