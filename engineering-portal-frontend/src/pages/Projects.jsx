import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import {
  Plus,
  Search,
  Filter,
  FolderKanban,
  FileText,
  Users,
  Clock,
  MoreVertical,
  Archive,
  ArchiveRestore,
  Trash2,
  X,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Check
} from 'lucide-react'
import { projectsAPI, adminAPI } from '../api/client'
import { formatDistanceToNow } from 'date-fns'
import clsx from 'clsx'
import { StackedAvatars } from '../components/OnlineUsersIndicator'

// Create Project Modal
function CreateProjectModal({ isOpen, onClose }) {
  const queryClient = useQueryClient()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      name: '',
      code: '',
      brief: '',
      description: '',
    },
  })

  const createMutation = useMutation({
    mutationFn: projectsAPI.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Project created successfully!')
      reset()
      onClose()
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to create project')
    },
  })

  const onSubmit = (data) => {
    createMutation.mutate(data)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-surface-900/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-modal w-full max-w-lg animate-scale-in max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-surface-100 z-10">
          <h2 className="text-base sm:text-lg font-semibold text-surface-900">Create New Project</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-surface-100 transition-colors"
          >
            <X size={18} className="text-surface-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-4 sm:p-6 space-y-4 sm:space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">
              Project Name <span className="text-accent-red">*</span>
            </label>
            <input
              {...register('name', { required: 'Project name is required' })}
              className="w-full h-11 px-4 bg-surface-50 border border-surface-200 rounded-xl text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all"
              placeholder="e.g., Highway Bridge Design 2024"
            />
            {errors.name && (
              <p className="mt-1.5 text-sm text-accent-red">{errors.name.message}</p>
            )}
          </div>

          {/* Code */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">
              Project Code <span className="text-accent-red">*</span>
            </label>
            <input
              {...register('code', { 
                required: 'Project code is required',
                pattern: {
                  value: /^[A-Z0-9_-]+$/i,
                  message: 'Only letters, numbers, dashes and underscores allowed'
                },
                minLength: { value: 2, message: 'Code must be at least 2 characters' },
                maxLength: { value: 20, message: 'Code must be at most 20 characters' }
              })}
              className="w-full h-11 px-4 bg-surface-50 border border-surface-200 rounded-xl text-surface-900 font-mono placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all uppercase"
              placeholder="e.g., HBD-2024"
            />
            {errors.code && (
              <p className="mt-1.5 text-sm text-accent-red">{errors.code.message}</p>
            )}
          </div>

          {/* Brief */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">
              Brief Summary
            </label>
            <input
              {...register('brief', { maxLength: { value: 500, message: 'Brief must be 500 characters or less' } })}
              className="w-full h-11 px-4 bg-surface-50 border border-surface-200 rounded-xl text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all"
              placeholder="Short description of the project"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">
              Description
            </label>
            <textarea
              {...register('description')}
              rows={4}
              className="w-full px-4 py-3 bg-surface-50 border border-surface-200 rounded-xl text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all resize-none"
              placeholder="Detailed description of the project scope, objectives, and requirements..."
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-medium text-surface-600 hover:text-surface-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-5 py-2.5 bg-primary-600 text-white font-medium text-sm rounded-xl hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus size={16} />
                  Create Project
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Project Card
function ProjectCard({ project, onArchive, onRestore, onComplete, onDelete, onlineUserIds = [] }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const isArchived = project.status === 'archived' || project.status === 'ARCHIVED'
  const isCompleted = project.status === 'completed' || project.status === 'COMPLETED'
  const isActive = project.status === 'active' || project.status === 'ACTIVE' || !project.status

  const statusColors = {
    ACTIVE: { bg: 'bg-accent-green/10', text: 'text-accent-green', dot: 'bg-accent-green' },
    active: { bg: 'bg-accent-green/10', text: 'text-accent-green', dot: 'bg-accent-green' },
    COMPLETED: { bg: 'bg-primary-100', text: 'text-primary-600', dot: 'bg-primary-500' },
    completed: { bg: 'bg-primary-100', text: 'text-primary-600', dot: 'bg-primary-500' },
    ARCHIVED: { bg: 'bg-surface-200', text: 'text-surface-500', dot: 'bg-surface-400' },
    archived: { bg: 'bg-surface-200', text: 'text-surface-500', dot: 'bg-surface-400' },
  }

  const status = statusColors[project.status] || statusColors.ACTIVE

  // Get members from project data
  const members = project.members || []

  return (
    <div className={clsx(
      "bg-white rounded-xl sm:rounded-2xl border hover:shadow-hover transition-all duration-200 overflow-hidden group",
      isArchived ? "border-surface-300 opacity-75" : "border-surface-200 hover:border-surface-300"
    )}>
      {/* Header */}
      <div className="p-4 sm:p-5 pb-3 sm:pb-4">
        <div className="flex items-start justify-between mb-2 sm:mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1 flex-wrap">
              <span className="text-xs font-mono text-surface-400 bg-surface-100 px-1.5 sm:px-2 py-0.5 rounded">
                {project.code}
              </span>
              <span className={clsx(
                'px-1.5 sm:px-2 py-0.5 text-xs font-medium rounded-full flex items-center gap-1 sm:gap-1.5',
                status.bg, status.text
              )}>
                <span className={clsx('w-1.5 h-1.5 rounded-full', status.dot)} />
                {project.status || 'active'}
              </span>
            </div>
            <Link
              to={`/projects/${project.id}`}
              className="font-semibold text-surface-900 group-hover:text-primary-600 transition-colors line-clamp-2 sm:line-clamp-1 text-base sm:text-lg break-words"
            >
              {project.name}
            </Link>
          </div>

          {/* Actions Menu */}
          <div className="relative ml-2 sm:ml-3">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-1 sm:p-1.5 rounded-lg hover:bg-surface-100 transition-colors"
            >
              <MoreVertical size={16} className="text-surface-400 sm:hidden" />
              <MoreVertical size={18} className="text-surface-400 hidden sm:inline" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 mt-1 w-48 bg-white rounded-xl shadow-modal border border-surface-200 py-1 z-20 animate-slide-down">
                  {/* Status actions based on current status */}
                  {isActive && (
                    <>
                      <button
                        onClick={() => {
                          onComplete(project.id)
                          setMenuOpen(false)
                        }}
                        className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-primary-600 hover:bg-primary-50"
                      >
                        <Check size={15} />
                        Mark as completed
                      </button>
                      <button
                        onClick={() => {
                          onArchive(project.id)
                          setMenuOpen(false)
                        }}
                        className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-surface-600 hover:bg-surface-50"
                      >
                        <Archive size={15} />
                        Archive project
                      </button>
                    </>
                  )}
                  {isCompleted && (
                    <>
                      <button
                        onClick={() => {
                          onRestore(project.id)
                          setMenuOpen(false)
                        }}
                        className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-primary-600 hover:bg-primary-50"
                      >
                        <ArchiveRestore size={15} />
                        Reopen project
                      </button>
                      <button
                        onClick={() => {
                          onArchive(project.id)
                          setMenuOpen(false)
                        }}
                        className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-surface-600 hover:bg-surface-50"
                      >
                        <Archive size={15} />
                        Archive project
                      </button>
                    </>
                  )}
                  {isArchived && (
                    <button
                      onClick={() => {
                        onRestore(project.id)
                        setMenuOpen(false)
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-primary-600 hover:bg-primary-50"
                    >
                      <ArchiveRestore size={15} />
                      Restore project
                    </button>
                  )}
                  <button
                    onClick={() => {
                      onDelete(project.id)
                      setMenuOpen(false)
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-accent-red hover:bg-red-50"
                  >
                    <Trash2 size={15} />
                    Delete project
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <p className="text-xs sm:text-sm text-surface-500 line-clamp-2 min-h-[2rem] sm:min-h-[2.5rem] break-words">
          {project.brief || project.description || 'No description provided'}
        </p>
      </div>

      {/* Footer */}
      <div className="px-4 sm:px-5 py-2.5 sm:py-3 bg-surface-50 border-t border-surface-100 flex items-center justify-between">
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Documents count */}
          <span className="flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm text-surface-500">
            <FileText size={12} className="sm:hidden" />
            <FileText size={14} className="hidden sm:inline" />
            <span>{project.document_count || 0}</span>
          </span>

          {/* Members avatars with online status */}
          {members.length > 0 ? (
            <StackedAvatars
              users={members.map(m => ({
                id: m.user_id,
                user_id: m.user_id,
                full_name: m.full_name,
                email: m.email
              }))}
              onlineUserIds={onlineUserIds}
              maxVisible={3}
              size="sm"
            />
          ) : (
            <span className="flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm text-surface-500">
              <Users size={12} className="sm:hidden" />
              <Users size={14} className="hidden sm:inline" />
              <span>{project.member_count || 1}</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 sm:gap-1.5 text-xs text-surface-400">
          <Clock size={11} className="sm:hidden flex-shrink-0" />
          <Clock size={12} className="hidden sm:inline flex-shrink-0" />
          <span className="hidden sm:inline">{formatDistanceToNow(new Date(project.updated_at), { addSuffix: true })}</span>
          <span className="sm:hidden truncate max-w-[80px]">{formatDistanceToNow(new Date(project.updated_at), { addSuffix: true }).replace('about ', '').replace(' ago', '')}</span>
        </div>
      </div>
    </div>
  )
}

function Projects() {
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()

  // Check for action param and initialize modal state
  const actionParam = searchParams.get('action')
  const shouldOpenCreateModal = actionParam === 'create'

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(shouldOpenCreateModal)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('active')
  const [page, setPage] = useState(0)
  const limit = 12

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput)
      setPage(0)
    }, 500)

    return () => clearTimeout(timer)
  }, [searchInput])

  // Clean up action param from URL after initial render
  useEffect(() => {
    if (actionParam === 'create') {
      const newParams = new URLSearchParams(searchParams)
      newParams.delete('action')
      setSearchParams(newParams, { replace: true })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch projects
  const { data, isLoading, error } = useQuery({
    queryKey: ['projects', { skip: page * limit, limit, search, statusFilter }],
    queryFn: () => projectsAPI.list({
      skip: page * limit,
      limit,
      search: search || undefined,
      status: statusFilter === 'all' ? undefined : statusFilter,
    }),
  })

  // Fetch online users to show their status on project cards
  const { data: onlineUsersData } = useQuery({
    queryKey: ['online-users'],
    queryFn: () => adminAPI.getOnlineUsers(5),
    refetchInterval: 15000, // Refresh every 15 seconds for real-time feel
    staleTime: 10000,
  })

  // Get array of online user IDs
  const onlineUserIds = (onlineUsersData?.online_users || []).map(u => u.id)

  // Archive mutation
  const archiveMutation = useMutation({
    mutationFn: projectsAPI.archive,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Project archived')
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to archive project')
    },
  })

  // Restore mutation
  const restoreMutation = useMutation({
    mutationFn: projectsAPI.restore,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Project restored')
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to restore project')
    },
  })

  // Complete mutation
  const completeMutation = useMutation({
    mutationFn: projectsAPI.complete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Project marked as completed')
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to complete project')
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: projectsAPI.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Project deleted')
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to delete project')
    },
  })

  const projects = data?.projects || []
  const total = data?.total || 0
  const totalPages = Math.ceil(total / limit)

  return (
    <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6 px-4 sm:px-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-surface-900">Projects</h1>
          <p className="text-sm sm:text-base text-surface-500 mt-1">
            Manage your engineering documentation projects
          </p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white font-medium rounded-xl hover:bg-primary-700 transition-colors w-full sm:w-auto"
        >
          <Plus size={18} />
          <span>New Project</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        {/* Search */}
        <div className="relative flex-1 sm:max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 sm:hidden" />
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400 hidden sm:inline" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search projects..."
            className="w-full h-10 sm:h-11 pl-9 sm:pl-10 pr-4 bg-white border border-surface-200 rounded-xl text-sm sm:text-base text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-surface-400 sm:hidden" />
          <Filter size={16} className="text-surface-400 hidden sm:inline" />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(0)
            }}
            className="flex-1 sm:flex-initial h-10 sm:h-11 px-3 sm:px-4 bg-white border border-surface-200 rounded-xl text-sm sm:text-base text-surface-700 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all"
          >
            <option value="all">All Projects</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      {/* Projects Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-44 sm:h-48 bg-surface-100 rounded-xl sm:rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-red-50 text-accent-red p-4 sm:p-6 rounded-xl sm:rounded-2xl text-center text-sm sm:text-base">
          Failed to load projects. Please try again.
        </div>
      ) : projects.length === 0 ? (
        <div className="bg-white rounded-xl sm:rounded-2xl border border-surface-200 p-8 sm:p-12 text-center">
          <FolderKanban size={48} className="mx-auto text-surface-300 mb-3 sm:mb-4 sm:hidden" />
          <FolderKanban size={56} className="mx-auto text-surface-300 mb-4 hidden sm:inline" />
          <h3 className="text-base sm:text-lg font-semibold text-surface-700 mb-2">No projects found</h3>
          <p className="text-sm sm:text-base text-surface-500 mb-4 sm:mb-6">
            {search ? 'Try adjusting your search or filters' : 'Get started by creating your first project'}
          </p>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary-600 text-white font-medium rounded-xl hover:bg-primary-700 transition-colors w-full sm:w-auto"
          >
            <Plus size={18} />
            <span>Create Project</span>
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onlineUserIds={onlineUserIds}
                onArchive={(id) => archiveMutation.mutate(id)}
                onRestore={(id) => restoreMutation.mutate(id)}
                onComplete={(id) => completeMutation.mutate(id)}
                onDelete={(id) => {
                  if (window.confirm('Are you sure you want to delete this project? This cannot be undone.')) {
                    deleteMutation.mutate(id)
                  }
                }}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-sm text-surface-500">
                Showing {page * limit + 1} - {Math.min((page + 1) * limit, total)} of {total} projects
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="p-2 rounded-lg border border-surface-200 hover:bg-surface-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="text-sm text-surface-600 min-w-[100px] text-center">
                  Page {page + 1} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="p-2 rounded-lg border border-surface-200 hover:bg-surface-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Create Modal */}
      <CreateProjectModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  )
}

export default Projects
