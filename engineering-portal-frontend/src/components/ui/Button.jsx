import { forwardRef } from 'react'
import { Loader2 } from 'lucide-react'
import clsx from 'clsx'

const variants = {
  primary: 'bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500/50',
  secondary: 'bg-surface-100 text-surface-700 hover:bg-surface-200 focus:ring-surface-300',
  danger: 'bg-accent-red text-white hover:bg-red-600 focus:ring-red-500/50',
  ghost: 'text-surface-600 hover:bg-surface-100 focus:ring-surface-300',
  outline: 'border border-surface-200 text-surface-700 hover:bg-surface-50 focus:ring-surface-300',
}

const sizes = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
  icon: 'h-10 w-10',
}

const Button = forwardRef(({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  leftIcon,
  rightIcon,
  className,
  ...props
}, ref) => {
  const Icon = leftIcon

  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all',
        'focus:outline-none focus:ring-2 focus:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {loading ? (
        <Loader2 size={18} className="animate-spin" />
      ) : leftIcon ? (
        <Icon size={18} />
      ) : null}
      {children}
      {rightIcon && !loading && <rightIcon size={18} />}
    </button>
  )
})

Button.displayName = 'Button'

export default Button
