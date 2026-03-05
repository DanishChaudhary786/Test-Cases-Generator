import type { ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import clsx from 'clsx'

interface ButtonProps {
  children: ReactNode
  onClick?: () => void
  type?: 'button' | 'submit'
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  loading?: boolean
  className?: string
  icon?: ReactNode
}

export default function Button({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  className,
  icon,
}: ButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-2'
  
  const variantStyles = {
    primary: 'bg-success-primary text-white hover:bg-success-primary/90 focus:ring-success-primary disabled:bg-neutral-grey',
    secondary: 'bg-neutral-lightest-grey text-text-primary hover:bg-neutral-grey focus:ring-neutral-grey disabled:bg-neutral-light-grey',
    outline: 'border-2 border-neutral-grey text-text-primary hover:border-neutral-dark-grey focus:ring-neutral-grey disabled:border-neutral-light-grey',
    ghost: 'text-text-secondary hover:bg-neutral-lightest-grey focus:ring-neutral-grey',
    danger: 'bg-failure-primary text-white hover:bg-failure-primary/90 focus:ring-failure-primary disabled:bg-neutral-grey',
  }
  
  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base',
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={clsx(
        baseStyles,
        variantStyles[variant],
        sizeStyles[size],
        disabled && 'cursor-not-allowed opacity-60',
        className
      )}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : icon ? (
        icon
      ) : null}
      {children}
    </button>
  )
}
