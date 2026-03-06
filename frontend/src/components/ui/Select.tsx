import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Search, X, Check, Loader2 } from 'lucide-react'
import clsx from 'clsx'

interface Option {
  value: string
  label: string
  description?: string
}

interface SelectProps {
  options: Option[]
  value: string | string[] | null
  onChange: (value: string | string[] | null) => void
  placeholder?: string
  searchable?: boolean
  multiple?: boolean
  loading?: boolean
  disabled?: boolean
  clearable?: boolean
  label?: string
  error?: string
}

export default function Select({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  searchable = false,
  multiple = false,
  loading = false,
  disabled = false,
  clearable = false,
  label,
  error,
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (isOpen && searchable && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen, searchable])

  const filteredOptions = options.filter(
    (opt) =>
      opt.label.toLowerCase().includes(search.toLowerCase()) ||
      opt.description?.toLowerCase().includes(search.toLowerCase())
  )

  const selectedValues = multiple ? (value as string[] || []) : value ? [value as string] : []
  const selectedOptions = options.filter((opt) => selectedValues.includes(opt.value))

  const handleSelect = (optionValue: string) => {
    if (multiple) {
      const current = value as string[] || []
      if (current.includes(optionValue)) {
        onChange(current.filter((v) => v !== optionValue))
      } else {
        onChange([...current, optionValue])
      }
      setIsOpen(false)
    } else {
      onChange(optionValue)
      setIsOpen(false)
    }
    setSearch('')
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(multiple ? [] : null)
  }

  const displayValue = multiple
    ? selectedOptions.length > 0
      ? selectedOptions.map(opt => opt.label).join(', ')
      : placeholder
    : selectedOptions[0]?.label || placeholder

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className="block text-sm font-medium text-text-secondary mb-1.5">
          {label}
        </label>
      )}
      
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled || loading}
        className={clsx(
          'w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-all text-left',
          {
            'border-success-primary ring-2 ring-success-secondary': isOpen,
            'border-failure-primary': error,
            'border-neutral-grey hover:border-neutral-dark-grey': !isOpen && !error,
            'bg-neutral-light-grey cursor-not-allowed': disabled,
            'bg-white cursor-pointer': !disabled,
          }
        )}
      >
        <span
          className={clsx('truncate flex-1', {
            'text-text-primary': selectedOptions.length > 0 && !loading,
            'text-text-tertiary': selectedOptions.length === 0 || loading,
          })}
          title={multiple && selectedOptions.length > 0 ? displayValue : undefined}
        >
          {displayValue}
        </span>
        <div className="flex items-center gap-2">
          {clearable && selectedOptions.length > 0 && !disabled && !loading && (
            <button
              onClick={handleClear}
              className="p-1 hover:bg-neutral-lightest-grey rounded"
            >
              <X className="w-4 h-4 text-text-tertiary" />
            </button>
          )}
          {loading ? (
            <Loader2 className="w-5 h-5 text-success-primary animate-spin" />
          ) : (
            <ChevronDown
              className={clsx('w-5 h-5 text-text-tertiary transition-transform', {
                'rotate-180': isOpen,
              })}
            />
          )}
        </div>
      </button>

      {error && <p className="mt-1 text-sm text-failure-primary">{error}</p>}

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-neutral-grey rounded-lg shadow-lg max-h-64 overflow-hidden">
          {searchable && (
            <div className="p-2 border-b border-neutral-lightest-grey">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                <input
                  ref={inputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search..."
                  className="w-full pl-9 pr-4 py-2 text-sm border border-neutral-grey rounded-md focus:outline-none focus:border-success-primary"
                />
              </div>
            </div>
          )}

          <div className="overflow-y-auto max-h-48">
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-3 text-sm text-text-tertiary text-center">
                No options found
              </div>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = selectedValues.includes(option.value)
                return (
                  <button
                    key={option.value}
                    onClick={() => handleSelect(option.value)}
                    className={clsx(
                      'w-full flex items-center justify-between px-4 py-3 text-left hover:bg-neutral-light-grey transition-colors',
                      {
                        'bg-success-secondary/30': isSelected,
                      }
                    )}
                  >
                    <div>
                      <div className="text-sm font-medium text-text-primary">
                        {option.label}
                      </div>
                      {option.description && (
                        <div className="text-xs text-text-tertiary mt-0.5">
                          {option.description}
                        </div>
                      )}
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-success-primary" />}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
