import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Users } from 'lucide-react'
import { adminAPI } from '../api/client'
import clsx from 'clsx'

/**
 * Shows online users count with expandable list
 * Can be used anywhere in the app
 */
export function OnlineUsersIndicator({ className = '' }) {
  const [isExpanded, setIsExpanded] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['online-users'],
    queryFn: () => adminAPI.getOnlineUsers(5), // 5 minute threshold
    refetchInterval: 15000, // Refetch every 15 seconds for real-time feel
    staleTime: 10000, // Consider data stale after 10 seconds
  })

  const onlineCount = data?.online_count || 0
  const onlineUsers = data?.online_users || []

  return (
    <div className={clsx('relative', className)}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-surface-100 transition-colors"
      >
        <div className="relative">
          <Users size={18} className="text-surface-600" />
          {onlineCount > 0 && (
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-accent-green rounded-full animate-pulse" />
          )}
        </div>
        <span className="text-sm font-medium text-surface-700">
          {isLoading ? '...' : `${onlineCount} online`}
        </span>
      </button>

      {/* Dropdown */}
      {isExpanded && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsExpanded(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-modal border border-surface-200 py-2 z-20 animate-slide-down">
            <div className="px-4 py-2 border-b border-surface-100">
              <h4 className="text-sm font-semibold text-surface-900">Online Users</h4>
              <p className="text-xs text-surface-500">{onlineCount} team members online</p>
            </div>

            <div className="max-h-64 overflow-y-auto">
              {onlineUsers.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-surface-500">
                  No users online
                </div>
              ) : (
                onlineUsers.map((user) => (
                  <OnlineUserItem key={user.id} user={user} />
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/**
 * Single user item in online list
 */
function OnlineUserItem({ user }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 hover:bg-surface-50 transition-colors">
      <div className="relative flex-shrink-0">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-xs font-semibold">
          {user.full_name?.charAt(0)?.toUpperCase() || '?'}
        </div>
        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-accent-green border-2 border-white rounded-full" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-surface-900 truncate">{user.full_name}</p>
        <p className="text-xs text-surface-500 truncate">{user.email}</p>
      </div>
    </div>
  )
}

/**
 * Small online status dot with optional tooltip
 */
export function OnlineStatusDot({ isOnline, size = 'sm', showTooltip = true }) {
  const sizes = {
    xs: 'w-1.5 h-1.5',
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
  }

  return (
    <span
      className={clsx(
        'rounded-full flex-shrink-0',
        sizes[size],
        isOnline ? 'bg-accent-green' : 'bg-surface-300'
      )}
      title={showTooltip ? (isOnline ? 'Online' : 'Offline') : undefined}
    />
  )
}

/**
 * User avatar with online status indicator
 */
export function UserAvatarWithStatus({
  user,
  isOnline = false,
  size = 'md',
  showStatus = true
}) {
  const sizes = {
    sm: { container: 'w-6 h-6', text: 'text-[10px]', dot: 'w-2 h-2' },
    md: { container: 'w-8 h-8', text: 'text-xs', dot: 'w-2.5 h-2.5' },
    lg: { container: 'w-10 h-10', text: 'text-sm', dot: 'w-3 h-3' },
  }

  const s = sizes[size]

  return (
    <div className="relative flex-shrink-0">
      <div
        className={clsx(
          'rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-semibold',
          s.container,
          s.text
        )}
        title={user.full_name || user.user_name || user.email}
      >
        {(user.full_name || user.user_name || user.email || '?').charAt(0).toUpperCase()}
      </div>
      {showStatus && (
        <span
          className={clsx(
            'absolute -bottom-0.5 -right-0.5 border-2 border-white rounded-full',
            s.dot,
            isOnline ? 'bg-accent-green' : 'bg-surface-300'
          )}
          title={isOnline ? 'Online' : 'Offline'}
        />
      )}
    </div>
  )
}

/**
 * Stacked avatars for showing multiple users (like project members)
 */
export function StackedAvatars({
  users = [],
  onlineUserIds = [],
  maxVisible = 3,
  size = 'sm'
}) {
  const visibleUsers = users.slice(0, maxVisible)
  const remainingCount = users.length - maxVisible

  const sizes = {
    sm: { container: 'w-6 h-6', text: 'text-[10px]', overlap: '-ml-2', dot: 'w-1.5 h-1.5' },
    md: { container: 'w-8 h-8', text: 'text-xs', overlap: '-ml-2.5', dot: 'w-2 h-2' },
  }

  const s = sizes[size]

  return (
    <div className="flex items-center">
      {visibleUsers.map((user, index) => {
        const isOnline = onlineUserIds.includes(user.id || user.user_id)
        return (
          <div
            key={user.id || user.user_id || index}
            className={clsx('relative flex-shrink-0', index > 0 && s.overlap)}
            style={{ zIndex: visibleUsers.length - index }}
          >
            <div
              className={clsx(
                'rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-semibold border-2 border-white',
                s.container,
                s.text
              )}
              title={user.full_name || user.user_name || user.email}
            >
              {(user.full_name || user.user_name || user.email || '?').charAt(0).toUpperCase()}
            </div>
            <span
              className={clsx(
                'absolute -bottom-0.5 -right-0.5 border border-white rounded-full',
                s.dot,
                isOnline ? 'bg-accent-green' : 'bg-surface-300'
              )}
            />
          </div>
        )
      })}
      {remainingCount > 0 && (
        <div
          className={clsx(
            'rounded-full bg-surface-200 flex items-center justify-center text-surface-600 font-medium border-2 border-white',
            s.container,
            s.text,
            s.overlap
          )}
          title={`+${remainingCount} more members`}
        >
          +{remainingCount}
        </div>
      )}
    </div>
  )
}

export default OnlineUsersIndicator
