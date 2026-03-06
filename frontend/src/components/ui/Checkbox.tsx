import { Check } from 'lucide-react'
import clsx from 'clsx'

interface CheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  description?: string
  disabled?: boolean
}

export default function Checkbox({
  checked,
  onChange,
  label,
  description,
  disabled = false,
}: CheckboxProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) {
      onChange(!checked)
    }
  }

  return (
    <div
      onClick={handleClick}
      className={clsx(
        'flex items-start gap-3 cursor-pointer select-none',
        disabled && 'cursor-not-allowed opacity-60'
      )}
    >
      <div className="pt-0.5">
        <div
          role="checkbox"
          aria-checked={checked}
          className={clsx(
            'w-5 h-5 rounded border-2 flex items-center justify-center transition-all cursor-pointer',
            {
              'bg-success-primary border-success-primary': checked,
              'bg-white border-neutral-grey hover:border-neutral-dark-grey': !checked,
              'cursor-not-allowed': disabled,
            }
          )}
        >
          {checked && <Check className="w-3 h-3 text-white" />}
        </div>
      </div>
      {(label || description) && (
        <div className="flex-1">
          {label && (
            <span className="text-sm font-medium text-text-primary">{label}</span>
          )}
          {description && (
            <p className="text-xs text-text-tertiary mt-0.5">{description}</p>
          )}
        </div>
      )}
    </div>
  )
}
