import clsx from 'clsx'

function Skeleton({ className, ...props }) {
  return (
    <div
      className={clsx(
        'bg-surface-200 rounded-lg animate-pulse',
        className
      )}
      {...props}
    />
  )
}

function SkeletonCard({ className }) {
  return (
    <div className={clsx('bg-white rounded-2xl border border-surface-200 p-6', className)}>
      <div className="flex items-start gap-4">
        <Skeleton className="w-12 h-12 rounded-xl" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </div>
  )
}

function SkeletonRow({ className }) {
  return (
    <div className={clsx('flex items-center gap-4 p-4 bg-white rounded-xl border border-surface-200', className)}>
      <Skeleton className="w-10 h-10 rounded-lg" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3 w-1/4" />
      </div>
      <Skeleton className="h-6 w-16 rounded-full" />
    </div>
  )
}

function SkeletonText({ lines = 3, className }) {
  return (
    <div className={clsx('space-y-2', className)}>
      {[...Array(lines)].map((_, i) => (
        <Skeleton 
          key={i} 
          className="h-3" 
          style={{ width: i === lines - 1 ? '60%' : '100%' }}
        />
      ))}
    </div>
  )
}

Skeleton.Card = SkeletonCard
Skeleton.Row = SkeletonRow
Skeleton.Text = SkeletonText

export default Skeleton
