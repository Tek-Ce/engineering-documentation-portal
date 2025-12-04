import clsx from 'clsx'

const variants = {
  default: 'bg-surface-100 text-surface-600',
  primary: 'bg-primary-100 text-primary-600',
  success: 'bg-green-100 text-accent-green',
  warning: 'bg-amber-100 text-accent-amber',
  danger: 'bg-red-100 text-accent-red',
  info: 'bg-cyan-100 text-accent-cyan',
}

const sizes = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-xs',
  lg: 'px-3 py-1.5 text-sm',
}

function Badge({ 
  children, 
  variant = 'default', 
  size = 'md',
  dot = false,
  className 
}) {
  return (
    <span 
      className={clsx(
        'inline-flex items-center gap-1.5 font-medium rounded-full',
        variants[variant],
        sizes[size],
        className
      )}
    >
      {dot && (
        <span className={clsx(
          'w-1.5 h-1.5 rounded-full',
          variant === 'default' && 'bg-surface-400',
          variant === 'primary' && 'bg-primary-500',
          variant === 'success' && 'bg-accent-green',
          variant === 'warning' && 'bg-accent-amber',
          variant === 'danger' && 'bg-accent-red',
          variant === 'info' && 'bg-accent-cyan',
        )} />
      )}
      {children}
    </span>
  )
}

export default Badge
