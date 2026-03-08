import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  Upload,
  MessageSquare,
  AtSign,
  FileText,
  FolderKanban,
  Clock,
  Loader2,
  Eye,
  CheckCircle,
  XCircle
} from 'lucide-react'
import { notificationsAPI } from '../api/client'
import { formatDistanceToNow, format } from 'date-fns'
import clsx from 'clsx'

// Notification Item
function NotificationItem({ notification, onMarkRead, onDelete, onOpen }) {
  const typeConfig = {
    DOCUMENT_UPLOAD: {
      icon: Upload,
      color: 'bg-primary-500',
      label: 'Document'
    },
    COMMENT: {
      icon: MessageSquare,
      color: 'bg-accent-amber',
      label: 'Comment'
    },
    MENTION: {
      icon: AtSign,
      color: 'bg-accent-cyan',
      label: 'Mention'
    },
    PROJECT: {
      icon: FolderKanban,
      color: 'bg-accent-green',
      label: 'Project'
    },
    DOCUMENT_VERSION_UPLOAD: {
      icon: Upload,
      color: 'bg-primary-400',
      label: 'New version'
    },
    DOCUMENT_REVIEW_REQUESTED: {
      icon: Eye,
      color: 'bg-amber-500',
      label: 'Review requested'
    },
    DOCUMENT_APPROVED: {
      icon: CheckCircle,
      color: 'bg-accent-green',
      label: 'Approved'
    },
    DOCUMENT_REJECTED: {
      icon: XCircle,
      color: 'bg-red-500',
      label: 'Rejected'
    },
    default: {
      icon: Bell,
      color: 'bg-surface-400',
      label: 'Notification'
    },
  }

  const config = typeConfig[notification.type] || typeConfig.default
  const Icon = config.icon

  // Determine link based on notification type
  const getLink = () => {
    if (notification.document_id) {
      return `/documents/${notification.document_id}`
    }
    if (notification.project_id) {
      return `/projects/${notification.project_id}`
    }
    return null
  }

  const link = getLink()
  const ContentWrapper = link ? Link : 'div'

  // Auto-mark as read when notification is clicked/opened
  const handleClick = () => {
    if (!notification.is_read && link) {
      onOpen(notification.id)
    }
  }

  return (
    <div
      className={clsx(
        'flex items-start gap-4 p-4 rounded-xl transition-all group',
        notification.is_read
          ? 'bg-surface-50'
          : 'bg-white border border-surface-200 shadow-card'
      )}
    >
      <div className={clsx(
        'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
        config.color
      )}>
        <Icon size={18} className="text-white" />
      </div>

      <ContentWrapper
        {...(link ? { to: link, onClick: handleClick } : {})}
        className="flex-1 min-w-0 cursor-pointer"
      >
        <div className="flex items-center gap-2 mb-1">
          <span className={clsx(
            'px-2 py-0.5 text-xs font-medium rounded-full',
            notification.is_read
              ? 'bg-surface-200 text-surface-500'
              : 'bg-primary-100 text-primary-600'
          )}>
            {config.label}
          </span>
          {!notification.is_read && (
            <span className="w-2 h-2 rounded-full bg-primary-500" />
          )}
        </div>
        <p className={clsx(
          'text-sm mb-1',
          notification.is_read ? 'text-surface-500' : 'text-surface-800 font-medium'
        )}>
          {notification.message}
        </p>
        <div className="flex items-center gap-1.5 text-xs text-surface-400">
          <Clock size={12} />
          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
        </div>
      </ContentWrapper>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {!notification.is_read && (
          <button
            onClick={() => onMarkRead(notification.id)}
            className="p-2 rounded-lg hover:bg-surface-100 transition-colors"
            title="Mark as read"
          >
            <Check size={16} className="text-surface-400 hover:text-primary-500" />
          </button>
        )}
        <button
          onClick={() => onDelete(notification.id)}
          className="p-2 rounded-lg hover:bg-red-50 transition-colors"
          title="Delete"
        >
          <Trash2 size={16} className="text-surface-400 hover:text-accent-red" />
        </button>
      </div>
    </div>
  )
}

function Notifications() {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState('all') // all, unread

  // Fetch notifications — poll every 15s so new items appear automatically
  const { data, isLoading, error } = useQuery({
    queryKey: ['notifications', filter],
    queryFn: () => filter === 'unread'
      ? notificationsAPI.getUnread()
      : notificationsAPI.list({ limit: 100 }),
    refetchInterval: 15000,
  })

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['notification-stats'],
    queryFn: notificationsAPI.getStats,
    refetchInterval: 15000,
  })

  // Mark single as read
  const markReadMutation = useMutation({
    mutationFn: notificationsAPI.markRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['notification-stats'] })
    },
  })

  // Mark all as read
  const markAllReadMutation = useMutation({
    mutationFn: notificationsAPI.markAllRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['notification-stats'] })
      toast.success('All notifications marked as read')
    },
  })

  // Delete notification
  const deleteMutation = useMutation({
    mutationFn: notificationsAPI.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['notification-stats'] })
      toast.success('Notification deleted')
    },
  })

  const notifications = data?.notifications || []

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Notifications</h1>
          <p className="text-surface-500 mt-1">
            Stay updated with your projects and documents
          </p>
        </div>
        
        {stats?.unread > 0 && (
          <button
            onClick={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 bg-surface-100 text-surface-700 font-medium rounded-xl hover:bg-surface-200 transition-colors disabled:opacity-50"
          >
            {markAllReadMutation.isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <CheckCheck size={16} />
            )}
            Mark all read
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-surface-200 p-4 text-center">
          <p className="text-2xl font-bold text-surface-900">{stats?.total || 0}</p>
          <p className="text-sm text-surface-500">Total</p>
        </div>
        <div className="bg-primary-50 rounded-xl border border-primary-200 p-4 text-center">
          <p className="text-2xl font-bold text-primary-600">{stats?.unread || 0}</p>
          <p className="text-sm text-primary-600">Unread</p>
        </div>
        <div className="bg-white rounded-xl border border-surface-200 p-4 text-center">
          <p className="text-2xl font-bold text-surface-900">{stats?.read || 0}</p>
          <p className="text-sm text-surface-500">Read</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilter('all')}
          className={clsx(
            'px-4 py-2 rounded-xl font-medium text-sm transition-colors',
            filter === 'all'
              ? 'bg-primary-600 text-white'
              : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
          )}
        >
          All
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={clsx(
            'px-4 py-2 rounded-xl font-medium text-sm transition-colors flex items-center gap-2',
            filter === 'unread'
              ? 'bg-primary-600 text-white'
              : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
          )}
        >
          Unread
          {stats?.unread > 0 && (
            <span className={clsx(
              'px-1.5 py-0.5 text-xs rounded-full',
              filter === 'unread' ? 'bg-white/20' : 'bg-primary-100 text-primary-600'
            )}>
              {stats.unread}
            </span>
          )}
        </button>
      </div>

      {/* Notifications List */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-surface-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-red-50 text-accent-red p-6 rounded-xl text-center">
          Failed to load notifications
        </div>
      ) : notifications.length === 0 ? (
        <div className="bg-white rounded-2xl border border-surface-200 p-12 text-center">
          <Bell size={56} className="mx-auto text-surface-300 mb-4" />
          <h3 className="text-lg font-semibold text-surface-700 mb-2">
            {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
          </h3>
          <p className="text-surface-500">
            {filter === 'unread' 
              ? "You're all caught up!" 
              : "You'll be notified about project updates and comments"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onMarkRead={(id) => markReadMutation.mutate(id)}
              onDelete={(id) => deleteMutation.mutate(id)}
              onOpen={(id) => markReadMutation.mutate(id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default Notifications
