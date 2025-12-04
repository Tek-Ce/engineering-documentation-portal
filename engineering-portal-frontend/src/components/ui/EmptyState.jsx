import clsx from 'clsx'

function EmptyState({ 
  icon: Icon, 
  title, 
  description, 
  action,
  className 
}) {
  return (
    <div className={clsx(
      'bg-white rounded-2xl border border-surface-200 p-12 text-center',
      className
    )}>
      {Icon && (
        <Icon size={56} className="mx-auto text-surface-300 mb-4" />
      )}
      {title && (
        <h3 className="text-lg font-semibold text-surface-700 mb-2">
          {title}
        </h3>
      )}
      {description && (
        <p className="text-surface-500 mb-6 max-w-sm mx-auto">
          {description}
        </p>
      )}
      {action}
    </div>
  )
}

export default EmptyState
