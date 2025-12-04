import { forwardRef } from 'react'
import clsx from 'clsx'

const Input = forwardRef(({
  label,
  error,
  helperText,
  leftIcon: LeftIcon,
  rightIcon: RightIcon,
  className,
  inputClassName,
  required,
  ...props
}, ref) => {
  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-surface-700 mb-1.5">
          {label}
          {required && <span className="text-accent-red ml-0.5">*</span>}
        </label>
      )}
      <div className="relative">
        {LeftIcon && (
          <LeftIcon 
            size={18} 
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400" 
          />
        )}
        <input
          ref={ref}
          className={clsx(
            'w-full h-11 bg-surface-50 border rounded-xl text-surface-900',
            'placeholder:text-surface-400 transition-all',
            'focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            error 
              ? 'border-accent-red focus:ring-red-500/30 focus:border-accent-red' 
              : 'border-surface-200',
            LeftIcon ? 'pl-10' : 'px-4',
            RightIcon ? 'pr-10' : 'pr-4',
            inputClassName
          )}
          {...props}
        />
        {RightIcon && (
          <RightIcon 
            size={18} 
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-surface-400" 
          />
        )}
      </div>
      {error && (
        <p className="mt-1.5 text-sm text-accent-red">{error}</p>
      )}
      {helperText && !error && (
        <p className="mt-1.5 text-sm text-surface-500">{helperText}</p>
      )}
    </div>
  )
})

Input.displayName = 'Input'

export default Input
