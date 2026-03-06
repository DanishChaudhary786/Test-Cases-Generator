import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import clsx from 'clsx'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  className?: string
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  className,
}: ModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div 
        className={clsx(
          "relative bg-white rounded-xl shadow-xl max-w-md w-full mx-4 overflow-hidden",
          className
        )}
      >
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-lightest-grey">
            <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-neutral-lightest-grey transition-colors"
            >
              <X className="w-5 h-5 text-text-tertiary" />
            </button>
          </div>
        )}
        <div className="px-6 py-4">
          {children}
        </div>
      </div>
    </div>
  )
}
