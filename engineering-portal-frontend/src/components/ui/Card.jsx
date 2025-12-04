import clsx from 'clsx'

function Card({ children, className, hoverable = false, padding = true, ...props }) {
  return (
    <div 
      className={clsx(
        'bg-white rounded-2xl border border-surface-200',
        hoverable && 'hover:shadow-hover hover:border-surface-300 transition-all',
        padding && 'p-6',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

function CardHeader({ children, className }) {
  return (
    <div className={clsx(
      'flex items-center justify-between pb-4 mb-4 border-b border-surface-100',
      className
    )}>
      {children}
    </div>
  )
}

function CardTitle({ children, className }) {
  return (
    <h3 className={clsx('font-semibold text-surface-900', className)}>
      {children}
    </h3>
  )
}

function CardDescription({ children, className }) {
  return (
    <p className={clsx('text-sm text-surface-500 mt-1', className)}>
      {children}
    </p>
  )
}

function CardContent({ children, className }) {
  return (
    <div className={className}>
      {children}
    </div>
  )
}

function CardFooter({ children, className }) {
  return (
    <div className={clsx(
      'flex items-center justify-between pt-4 mt-4 border-t border-surface-100',
      className
    )}>
      {children}
    </div>
  )
}

Card.Header = CardHeader
Card.Title = CardTitle
Card.Description = CardDescription
Card.Content = CardContent
Card.Footer = CardFooter

export default Card
