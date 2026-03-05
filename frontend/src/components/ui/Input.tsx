import type { InputHTMLAttributes } from 'react'
import { forwardRef } from 'react'
import clsx from 'clsx'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  icon?: React.ReactNode
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, className, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-text-secondary mb-1.5">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={clsx(
              'w-full px-4 py-3 rounded-lg border transition-all focus:outline-none',
              'text-text-primary placeholder:text-text-tertiary',
              {
                'border-failure-primary focus:ring-2 focus:ring-failure-secondary': error,
                'border-neutral-grey hover:border-neutral-dark-grey focus:border-success-primary focus:ring-2 focus:ring-success-secondary': !error,
                'pl-10': icon,
              },
              className
            )}
            {...props}
          />
        </div>
        {error && <p className="mt-1 text-sm text-failure-primary">{error}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'

export default Input
