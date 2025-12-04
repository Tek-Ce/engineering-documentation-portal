import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { 
  FolderKanban, 
  FileText, 
  Bell, 
  TrendingUp, 
  ArrowRight,
  Plus,
  Clock,
  Upload
} from 'lucide-react'
import { projectsAPI, notificationsAPI } from '../api/client'
import { useAuthStore } from '../store/authStore'
import { formatDistanceToNow } from 'date-fns'
import clsx from 'clsx'

// Stat Card Component
function StatCard({ title, value, icon: Icon, color, trend, link }) {
  return (
    <Link
      to={link}
      className="bg-white rounded-2xl p-6 border border-surface-200 hover:shadow-hover hover:border-surface-300 transition-all duration-200 group"
    >
      <div className="flex items-start justify-between mb-4">
        <div className={clsx(
          'w-12 h-12 rounded-xl flex items-center justify-center',
          color
        )}>
          <Icon size={22} className="text-white" />
        </div>
        {trend && (
          <div className="flex items-center gap-1 text-accent-green text-sm font-medium">
            <TrendingUp size={14} />
            {trend}
          </div>
        )}
      </div>
      <p className="text-3xl font-bold text-surface-900 mb-1">{value}</p>
      <div className="flex items-center justify-between">
        <p className="text-sm text-surface-500">{title}</p>
        <ArrowRight size={16} className="text-surface-300 group-hover:text-primary-500 group-hover:translate-x-0.5 transition-all" />
      </div>
    </Link>
  )
}

// Quick Action Button
function QuickAction({ icon: Icon, label, onClick, variant = 'default' }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all',
        variant === 'primary'
          ? 'bg-primary-600 text-white hover:bg-primary-700'
          : 'bg-surface-100 text-surface-700 hover:bg-surface-200'
      )}
    >
      <Icon size={18} />
      {label}
    </button>
  )
}

// Project Card
function ProjectCard({ project }) {
  const statusColors = {
    ACTIVE: 'bg-accent-green/10 text-accent-green',
    COMPLETED: 'bg-primary-100 text-primary-600',
    ARCHIVED: 'bg-surface-200 text-surface-500',
  }

  return (
    <Link
      to={`/projects/${project.id}`}
      className="bg-white rounded-xl p-5 border border-surface-200 hover:shadow-hover hover:border-surface-300 transition-all duration-200 group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-surface-900 group-hover:text-primary-600 transition-colors line-clamp-1">
            {project.name}
          </h3>
          <p className="text-sm text-surface-500 mt-0.5 line-clamp-2">{project.brief || project.description}</p>
        </div>
        <span className={clsx(
          'px-2.5 py-1 text-xs font-medium rounded-full ml-3',
          statusColors[project.status] || statusColors.ACTIVE
        )}>
          {project.status || 'ACTIVE'}
        </span>
      </div>
      <div className="flex items-center gap-4 text-sm text-surface-500">
        <span className="flex items-center gap-1.5">
          <FileText size={14} />
          {project.document_count || 0} docs
        </span>
        <span className="flex items-center gap-1.5">
          <Clock size={14} />
          {formatDistanceToNow(new Date(project.updated_at), { addSuffix: true })}
        </span>
      </div>
    </Link>
  )
}

// Notification Item
function NotificationItem({ notification }) {
  const typeStyles = {
    DOCUMENT_UPLOAD: { color: 'bg-primary-500', icon: Upload },
    COMMENT: { color: 'bg-accent-amber', icon: FileText },
    MENTION: { color: 'bg-accent-cyan', icon: Bell },
    default: { color: 'bg-surface-400', icon: Bell },
  }

  const style = typeStyles[notification.type] || typeStyles.default
  const Icon = style.icon

  return (
    <div className={clsx(
      'flex items-start gap-3 p-4 rounded-xl transition-colors',
      notification.is_read ? 'bg-surface-50' : 'bg-primary-50/50'
    )}>
      <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center', style.color)}>
        <Icon size={14} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={clsx(
          'text-sm line-clamp-2',
          notification.is_read ? 'text-surface-600' : 'text-surface-900 font-medium'
        )}>
          {notification.message}
        </p>
        <p className="text-xs text-surface-400 mt-1">
          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
        </p>
      </div>
    </div>
  )
}

function Dashboard() {
  const { user } = useAuthStore()

  // Fetch active projects only
  const { data: projectsData, isLoading: projectsLoading } = useQuery({
    queryKey: ['projects', { limit: 5, status: 'active' }],
    queryFn: () => projectsAPI.list({ limit: 5, status: 'active' }),
  })

  // Fetch notifications
  const { data: notificationsData, isLoading: notificationsLoading } = useQuery({
    queryKey: ['notifications', { limit: 5 }],
    queryFn: () => notificationsAPI.list({ limit: 5 }),
  })

  // Fetch notification stats
  const { data: notifStats } = useQuery({
    queryKey: ['notification-stats'],
    queryFn: notificationsAPI.getStats,
  })

  const projects = projectsData?.projects || []
  const notifications = notificationsData?.notifications || []

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-surface-900">
          Welcome back, {user?.full_name?.split(' ')[0]}
        </h1>
        <p className="text-surface-500 mt-1">
          Here's what's happening with your projects today.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="My Projects"
          value={projectsData?.total || 0}
          icon={FolderKanban}
          color="bg-gradient-to-br from-primary-500 to-primary-700"
          link="/projects"
        />
        <StatCard
          title="Total Documents"
          value={projects.reduce((acc, p) => acc + (p.document_count || 0), 0)}
          icon={FileText}
          color="bg-gradient-to-br from-accent-cyan to-cyan-600"
          link="/projects"
        />
        <StatCard
          title="Unread Notifications"
          value={notifStats?.unread || 0}
          icon={Bell}
          color="bg-gradient-to-br from-accent-amber to-amber-600"
          link="/notifications"
        />
        <StatCard
          title="Active Projects"
          value={projectsData?.total || 0}
          icon={TrendingUp}
          color="bg-gradient-to-br from-accent-green to-green-600"
          link="/projects"
        />
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Link to="/projects?action=create">
          <QuickAction icon={Plus} label="Create Project" variant="primary" />
        </Link>
        <Link to="/projects">
          <QuickAction icon={Upload} label="Upload Document" />
        </Link>
        <Link to="/notifications">
          <QuickAction icon={Bell} label="View Notifications" />
        </Link>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Projects */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-surface-200 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100">
            <h2 className="font-semibold text-surface-900">Recent Projects</h2>
            <Link
              to="/projects"
              className="text-sm font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1"
            >
              View all
              <ArrowRight size={14} />
            </Link>
          </div>
          <div className="p-4 space-y-3">
            {projectsLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-24 bg-surface-100 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : projects.length === 0 ? (
              <div className="text-center py-12">
                <FolderKanban size={48} className="mx-auto text-surface-300 mb-4" />
                <h3 className="font-semibold text-surface-700 mb-1">No projects yet</h3>
                <p className="text-sm text-surface-500 mb-4">Create your first project to get started</p>
                <Link
                  to="/projects?action=create"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg font-medium text-sm hover:bg-primary-700 transition-colors"
                >
                  <Plus size={16} />
                  Create Project
                </Link>
              </div>
            ) : (
              projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))
            )}
          </div>
        </div>

        {/* Recent Notifications */}
        <div className="bg-white rounded-2xl border border-surface-200 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100">
            <h2 className="font-semibold text-surface-900">Notifications</h2>
            {notifStats?.unread > 0 && (
              <span className="px-2 py-0.5 bg-primary-100 text-primary-600 text-xs font-semibold rounded-full">
                {notifStats.unread} new
              </span>
            )}
          </div>
          <div className="p-3 space-y-2 max-h-[400px] overflow-y-auto">
            {notificationsLoading ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-16 bg-surface-100 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-8">
                <Bell size={36} className="mx-auto text-surface-300 mb-3" />
                <p className="text-sm text-surface-500">No notifications yet</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <NotificationItem key={notification.id} notification={notification} />
              ))
            )}
          </div>
          <div className="p-4 border-t border-surface-100">
            <Link
              to="/notifications"
              className="block w-full py-2 text-center text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
            >
              View all notifications
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
