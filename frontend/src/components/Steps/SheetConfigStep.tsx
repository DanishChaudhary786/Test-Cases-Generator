import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { useWizard } from '../../contexts/WizardContext'
import { sheetsApi, jiraApi } from '../../lib/api'
import type { Sheet, Subsheet } from '../../types'
import Select from '../ui/Select'
import Button from '../ui/Button'
import Input from '../ui/Input'
import { ArrowLeft, ArrowRight, Plus, X, GripVertical, FileSpreadsheet } from 'lucide-react'
import clsx from 'clsx'
import {
  MAX_COLUMNS,
  DEFAULT_COLUMNS,
  AI_POPULATED_COLUMNS,
  getSpecialColumnConfig,
  STEP_CONTENT,
  LABELS,
  PLACEHOLDERS,
  BUTTONS,
  STATUS,
  SUCCESS,
  ERRORS,
} from '../../constants'

export default function SheetConfigStep() {
  const { state, dispatch, nextStep, prevStep, canProceedToStep } = useWizard()
  const [isCreatingSubsheet, setIsCreatingSubsheet] = useState(false)
  const queryClient = useQueryClient()

  const { data: sheetsData, isLoading: sheetsLoading } = useQuery({
    queryKey: ['sheets'],
    queryFn: () => sheetsApi.listSheets(),
    staleTime: 5 * 60 * 1000,
  })

  const { data: subsheetsData, isLoading: subsheetsLoading } = useQuery({
    queryKey: ['subsheets', state.selectedSheet?.id],
    queryFn: () => sheetsApi.getSubsheets(state.selectedSheet!.id),
    enabled: !!state.selectedSheet,
    staleTime: 2 * 60 * 1000,
  })

  // Fetch data for special columns (Sprint, Tester, Link-type, Assignee)
  const { data: sprintsData } = useQuery({
    queryKey: ['sprints'],
    queryFn: () => jiraApi.getSprints(),
    staleTime: 5 * 60 * 1000,
  })

  const { data: testersData } = useQuery({
    queryKey: ['testers'],
    queryFn: () => jiraApi.getTesters(),
    staleTime: 5 * 60 * 1000,
  })

  const { data: linkTypesData } = useQuery({
    queryKey: ['linkTypes'],
    queryFn: () => jiraApi.getLinkTypes(),
    staleTime: 5 * 60 * 1000,
  })

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => jiraApi.getUsers(),
    staleTime: 5 * 60 * 1000,
  })

  const createSubsheetMutation = useMutation({
    mutationFn: ({ sheetId, name }: { sheetId: string; name: string }) =>
      sheetsApi.createSubsheet(sheetId, name),
    onSuccess: (data) => {
      toast.success(SUCCESS.SUBSHEET_CREATED(data.subsheet.name))
      dispatch({ type: 'SET_SUBSHEET', payload: data.subsheet })
      dispatch({ type: 'SET_NEW_SUBSHEET_NAME', payload: '' })
      setIsCreatingSubsheet(false)
      // Refetch subsheets to include the new one in the dropdown
      queryClient.invalidateQueries({ queryKey: ['subsheets', state.selectedSheet?.id] })
    },
    onError: (error: Error) => {
      toast.error(ERRORS.CREATE_SUBSHEET_FAILED(error.message))
    },
  })

  const sheets = sheetsData?.sheets || []
  const subsheets = subsheetsData?.subsheets || []

  const handleSheetChange = (value: string | string[] | null) => {
    const sheet = sheets.find((s: Sheet) => s.id === value) || null
    dispatch({ type: 'SET_SHEET', payload: sheet })
    setIsCreatingSubsheet(false)
  }

  const handleSubsheetChange = (value: string | string[] | null) => {
    const subsheet = subsheets.find((s: Subsheet) => s.id.toString() === value) || null
    dispatch({ type: 'SET_SUBSHEET', payload: subsheet })
  }

  const handleCreateSubsheet = () => {
    if (state.selectedSheet && state.newSubsheetName.trim()) {
      createSubsheetMutation.mutate({
        sheetId: state.selectedSheet.id,
        name: state.newSubsheetName.trim(),
      })
    }
  }

  const handleColumnChange = (index: number, value: string) => {
    const newColumns = [...state.columns]
    newColumns[index] = value
    dispatch({ type: 'SET_COLUMNS', payload: newColumns })
  }

  const handleAddColumn = () => {
    if (state.columns.length < MAX_COLUMNS) {
      dispatch({ type: 'SET_COLUMNS', payload: [...state.columns, ''] })
    }
  }

  const handleRemoveColumn = (index: number) => {
    if (state.columns.length > 1) {
      const newColumns = state.columns.filter((_, i) => i !== index)
      // Shift column defaults when removing from middle
      const newDefaults: Record<number, string> = {}
      Object.entries(state.columnDefaults).forEach(([key, value]) => {
        const oldIndex = parseInt(key)
        if (oldIndex < index) {
          newDefaults[oldIndex] = value
        } else if (oldIndex > index) {
          newDefaults[oldIndex - 1] = value
        }
        // Skip the removed index
      })
      dispatch({ type: 'SET_COLUMNS', payload: newColumns })
      // Update defaults after column removal
      Object.keys(state.columnDefaults).forEach(key => {
        dispatch({ type: 'REMOVE_COLUMN_DEFAULT', payload: parseInt(key) })
      })
      Object.entries(newDefaults).forEach(([key, value]) => {
        dispatch({ type: 'SET_COLUMN_DEFAULT', payload: { index: parseInt(key), value } })
      })
    }
  }

  const handleResetColumns = () => {
    dispatch({ type: 'SET_COLUMNS', payload: DEFAULT_COLUMNS })
    // Clear all column defaults when resetting
    Object.keys(state.columnDefaults).forEach(key => {
      dispatch({ type: 'REMOVE_COLUMN_DEFAULT', payload: parseInt(key) })
    })
  }

  const handleSetColumnDefault = (index: number, value: string) => {
    dispatch({ type: 'SET_COLUMN_DEFAULT', payload: { index, value } })
  }

  const canProceed = canProceedToStep(3)

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-xl font-semibold text-text-primary mb-2">
          {STEP_CONTENT.SHEET.TITLE}
        </h2>
        <p className="text-text-tertiary">
          {STEP_CONTENT.SHEET.DESCRIPTION}
        </p>
      </div>

      <div className="space-y-6">
        {/* Sheet Selection */}
        <Select
          label={LABELS.GOOGLE_SHEET}
          placeholder={PLACEHOLDERS.SELECT_SHEET}
          searchable
          loading={sheetsLoading}
          options={sheets.map((s: Sheet) => ({
            value: s.id,
            label: s.name,
            description: s.modifiedTime ? `Modified: ${new Date(s.modifiedTime).toLocaleDateString()}` : undefined,
          }))}
          value={state.selectedSheet?.id || null}
          onChange={handleSheetChange}
        />

        {/* Subsheet Selection */}
        {state.selectedSheet && (
          <div className="space-y-4">
            {!isCreatingSubsheet ? (
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <Select
                    label={LABELS.SUBSHEET_TAB}
                    placeholder={PLACEHOLDERS.SELECT_SUBSHEET}
                    searchable
                    loading={subsheetsLoading}
                    options={subsheets.map((s: Subsheet) => ({
                      value: s.id.toString(),
                      label: s.name,
                    }))}
                    value={state.selectedSubsheet?.id?.toString() || null}
                    onChange={handleSubsheetChange}
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={() => setIsCreatingSubsheet(true)}
                  icon={<Plus className="w-4 h-4" />}
                >
                  {BUTTONS.NEW_TAB}
                </Button>
              </div>
            ) : (
              <div className="p-4 bg-neutral-light-grey rounded-xl space-y-4">
                <label className="block text-sm font-medium text-text-secondary">
                  {LABELS.CREATE_NEW_SUBSHEET}
                </label>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <Input
                      placeholder={PLACEHOLDERS.ENTER_SUBSHEET_NAME}
                      value={state.newSubsheetName}
                      onChange={(e) => dispatch({ type: 'SET_NEW_SUBSHEET_NAME', payload: e.target.value })}
                    />
                  </div>
                  <Button
                    onClick={handleCreateSubsheet}
                    loading={createSubsheetMutation.isPending}
                    disabled={!state.newSubsheetName.trim()}
                  >
                    {BUTTONS.CREATE}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setIsCreatingSubsheet(false)
                      dispatch({ type: 'SET_NEW_SUBSHEET_NAME', payload: '' })
                    }}
                  >
                    {BUTTONS.CANCEL}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Column Configuration */}
        <div className="border border-neutral-grey rounded-xl">
          <div className="px-4 py-3 bg-neutral-light-grey border-b border-neutral-grey flex items-center justify-between">
            <div>
              <h3 className="font-medium text-text-primary">
                {LABELS.COLUMN_CONFIGURATION}
              </h3>
              <p className="text-sm text-text-tertiary">
                {STATUS.COLUMN_CONFIG_DESCRIPTION(MAX_COLUMNS)}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={handleResetColumns}>
              {BUTTONS.RESET_TO_DEFAULT}
            </Button>
          </div>

          <div className="p-4 space-y-3">
            {state.columns.map((column, index) => {
              const columnName = column.toLowerCase().trim()
              const isAiPopulated = AI_POPULATED_COLUMNS.includes(columnName)
              const specialConfig = getSpecialColumnConfig(column.trim())
              
              // Get dropdown options for special columns
              const getSpecialColumnOptions = () => {
                if (!specialConfig) return []
                
                switch (specialConfig.source) {
                  case 'jira_sprints':
                    return (sprintsData?.sprints || []).map((s: { id: number; name: string; state?: string }) => ({
                      value: s.id.toString(),
                      label: s.name,
                      description: s.state,
                    }))
                  case 'jira_testers':
                    return (testersData?.testers || []).map((t: { accountId: string; displayName: string }) => ({
                      value: t.accountId,
                      label: t.displayName,
                    }))
                  case 'jira_link_types':
                    return (linkTypesData?.link_types || []).map((lt: { id: string; name: string; inward?: string; outward?: string }) => ({
                      value: lt.inward || lt.name,
                      label: lt.inward || lt.name,
                      description: lt.name !== lt.inward ? lt.name : undefined,
                    }))
                  case 'jira_users':
                    return (usersData?.users || []).map((u: { accountId: string; displayName: string; emailAddress?: string }) => ({
                      value: u.accountId,
                      label: u.displayName,
                      description: u.emailAddress,
                    }))
                  default:
                    return []
                }
              }
              
              // Check if this column should only show the name input (AI-populated or auto-increment)
              const isNameOnly = isAiPopulated || specialConfig?.type === 'auto_increment'
              
              return (
              <div key={index} className="flex items-center gap-3">
                <div className="text-text-tertiary cursor-grab">
                  <GripVertical className="w-4 h-4" />
                </div>
                <div className="w-8 h-8 rounded-lg bg-neutral-lightest-grey flex items-center justify-center text-sm font-medium text-text-secondary shrink-0">
                  {index + 1}
                </div>
                
                {/* Column name input */}
                <div className={clsx(isNameOnly ? 'flex-1' : 'w-40 shrink-0')}>
                  <Input
                    placeholder={PLACEHOLDERS.COLUMN_PLACEHOLDER(index)}
                    value={column}
                    onChange={(e) => handleColumnChange(index, e.target.value)}
                  />
                </div>
                
                {/* Default value input or special column dropdown - only for columns that need it */}
                {!isNameOnly && (
                  <div className="flex-1 relative">
                    {specialConfig?.type === 'dropdown' ? (
                      <Select
                        placeholder={`Select ${column.trim()}...`}
                        options={getSpecialColumnOptions()}
                        value={state.columnDefaults[index] || null}
                        onChange={(value) => {
                          if (value && typeof value === 'string') {
                            handleSetColumnDefault(index, value)
                          } else {
                            dispatch({ type: 'REMOVE_COLUMN_DEFAULT', payload: index })
                          }
                        }}
                        searchable
                        clearable
                      />
                    ) : (
                      <Input
                        placeholder={PLACEHOLDERS.ENTER_DEFAULT_VALUE}
                        value={state.columnDefaults[index] || ''}
                        onChange={(e) => handleSetColumnDefault(index, e.target.value)}
                      />
                    )}
                  </div>
                )}
                
                {/* Remove column button */}
                <button
                  onClick={() => handleRemoveColumn(index)}
                  disabled={state.columns.length <= 1}
                  className={clsx(
                    'p-2 rounded-lg transition-colors shrink-0',
                    state.columns.length <= 1
                      ? 'text-neutral-grey cursor-not-allowed'
                      : 'text-text-tertiary hover:text-failure-primary hover:bg-failure-secondary'
                  )}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              )
            })}

            {state.columns.length < MAX_COLUMNS && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddColumn}
                icon={<Plus className="w-4 h-4" />}
                className="w-full mt-2"
              >
                {BUTTONS.ADD_COLUMN}
              </Button>
            )}
          </div>
        </div>

        {/* Preview */}
        {state.selectedSheet && (state.selectedSubsheet || state.newSubsheetName) && (
          <div className="p-4 bg-success-secondary/30 rounded-xl flex items-center gap-3">
            <FileSpreadsheet className="w-6 h-6 text-success-primary" />
            <div className="text-sm">
              <p className="font-medium text-text-primary">
                {STATUS.TEST_CASES_WILL_BE_WRITTEN}
              </p>
              <p className="text-text-secondary">
                {state.selectedSheet.name} → {state.selectedSubsheet?.name || state.newSubsheetName}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="mt-8 flex justify-between">
        <Button variant="outline" onClick={prevStep} icon={<ArrowLeft className="w-4 h-4" />}>
          {BUTTONS.BACK}
        </Button>
        <Button
          onClick={nextStep}
          disabled={!canProceed}
          icon={<ArrowRight className="w-4 h-4" />}
        >
          {BUTTONS.CONTINUE_TO_GENERATE}
        </Button>
      </div>
    </div>
  )
}
