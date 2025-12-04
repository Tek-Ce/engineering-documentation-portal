import { useEffect, useCallback } from 'react'
import { X } from 'lucide-react'
import clsx from 'clsx'

function Modal({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  size = 'md',
  showClose = true 
}) {
  // Close on escape key
  const handleEscape = useCallback((e) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }, [onClose])

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, handleEscape])

  if (!isOpen) return null

  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-[90vw]',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-surface-900/60 backdrop-blur-sm animate-fade-in" 
        onClick={onClose} 
      />
      
      {/* Modal */}
      <div 
        className={clsx(
          'relative bg-white rounded-2xl shadow-modal w-full animate-scale-in',
          sizes[size]
        )}
      >
        {/* Header */}
        {(title || showClose) && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100">
            {title && (
              <h2 className="text-lg font-semibold text-surface-900">{title}</h2>
            )}
            {showClose && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-surface-100 transition-colors ml-auto"
              >
                <X size={18} className="text-surface-500" />
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  )
}

// Modal Footer component for action buttons
function ModalFooter({ children, className }) {
  return (
    <div className={clsx(
      'flex items-center justify-end gap-3 pt-4 mt-2 border-t border-surface-100',
      className
    )}>
      {children}
    </div>
  )
}

Modal.Footer = ModalFooter

export default Modal
