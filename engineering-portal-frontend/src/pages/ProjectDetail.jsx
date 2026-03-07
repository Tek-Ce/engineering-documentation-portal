import { useState, useRef, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import {
  ArrowLeft,
  FileText,
  Users,
  Settings,
  Upload,
  MoreVertical,
  Download,
  Eye,
  Trash2,
  Clock,
  X,
  Loader2,
  Plus,
  UserPlus,
  Crown,
  Edit3,
  ChevronDown,
  Search
} from 'lucide-react'
import { projectsAPI, documentsAPI, usersAPI, tagsAPI, adminAPI } from '../api/client'
import { useAuthStore } from '../store/authStore'
import { formatDistanceToNow, format } from 'date-fns'
import clsx from 'clsx'
import ProjectCommentsSection from '../components/ProjectCommentsSection'
import { UserAvatarWithStatus } from '../components/OnlineUsersIndicator'

// Document Upload Modal – reviewers default to project creator unless changed
function UploadDocumentModal({ isOpen, onClose, projectId, project }) {
  const queryClient = useQueryClient()
  const fileInputRef = useRef(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [selectedTags, setSelectedTags] = useState([])
  const [selectedReviewers, setSelectedReviewers] = useState([])

  // Default reviewers to project creator when modal opens (owners/editors can change)
  useEffect(() => {
    if (isOpen && project?.created_by) {
      setSelectedReviewers([project.created_by])
    }
  }, [isOpen, project?.created_by])

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      title: '',
      description: '',
      status: 'draft',
      documentType: 'other',
    },
  })

  // Fetch available tags
  const { data: tagsData } = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagsAPI.list(),
    enabled: isOpen,
  })

  // Fetch project members for reviewer selection
  const { data: membersData } = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: () => projectsAPI.getMembers(projectId),
    enabled: isOpen,
  })

  const uploadMutation = useMutation({
    mutationFn: (data) => documentsAPI.upload(
      projectId,
      data.title,
      data.description,
      data.status,
      selectedFile,
      data.documentType,
      selectedTags,
      selectedReviewers
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-documents', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project-stats', projectId] })
      toast.success('Document uploaded successfully!')
      reset()
      setSelectedFile(null)
      setSelectedTags([])
      setSelectedReviewers([])
      onClose()
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to upload document')
    },
  })

  const onSubmit = (data) => {
    if (!selectedFile) {
      toast.error('Please select a file to upload')
      return
    }
    // Tags are now optional - users can edit them later via Edit Metadata
    uploadMutation.mutate(data)
  }

  const toggleTag = (tagId) => {
    setSelectedTags(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    )
  }

  const toggleReviewer = (userId) => {
    setSelectedReviewers(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    )
  }

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-surface-900/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-modal w-full max-w-lg animate-scale-in max-h-[90vh] sm:max-h-[85vh] overflow-y-auto">
        <div className="sticky top-0 bg-white flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-surface-100 z-10">
          <h2 className="text-base sm:text-lg font-semibold text-surface-900">Upload Document</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-100 transition-colors">
            <X size={18} className="text-surface-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-4 sm:p-6 space-y-4 sm:space-y-5">
          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">
              File <span className="text-accent-red">*</span>
            </label>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.md"
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className={clsx(
                'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors',
                selectedFile
                  ? 'border-primary-300 bg-primary-50'
                  : 'border-surface-200 hover:border-primary-300 hover:bg-surface-50'
              )}
            >
              {selectedFile ? (
                <div className="flex items-center justify-center gap-3">
                  <FileText size={24} className="text-primary-600" />
                  <div className="text-left">
                    <p className="font-medium text-surface-800">{selectedFile.name}</p>
                    <p className="text-sm text-surface-500">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <Upload size={32} className="mx-auto text-surface-300 mb-2" />
                  <p className="text-surface-600">Click to select a file</p>
                  <p className="text-sm text-surface-400 mt-1">PDF, DOC, DOCX, XLS, XLSX, TXT, MD</p>
                </>
              )}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">
              Title <span className="text-accent-red">*</span>
            </label>
            <input
              {...register('title', { required: 'Title is required' })}
              className="w-full h-11 px-4 bg-surface-50 border border-surface-200 rounded-xl text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all"
              placeholder="Document title"
            />
            {errors.title && (
              <p className="mt-1.5 text-sm text-accent-red">{errors.title.message}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">
              Description
            </label>
            <textarea
              {...register('description')}
              rows={3}
              className="w-full px-4 py-3 bg-surface-50 border border-surface-200 rounded-xl text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all resize-none"
              placeholder="Brief description of this document"
            />
          </div>

          {/* Document Type */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">
              Document Type <span className="text-accent-red">*</span>
            </label>
            <select
              {...register('documentType')}
              className="w-full h-11 px-4 bg-surface-50 border border-surface-200 rounded-xl text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all"
            >
              <option value="guide">Guide</option>
              <option value="config">Configuration</option>
              <option value="sop">SOP (Standard Operating Procedure)</option>
              <option value="report">Report</option>
              <option value="diagram">Diagram</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">
              Tags (Optional)
            </label>
            <div className="flex flex-wrap gap-2 p-3 bg-surface-50 border border-surface-200 rounded-xl min-h-[44px]">
              {tagsData?.tags?.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className={clsx(
                    'px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
                    selectedTags.includes(tag.id)
                      ? 'bg-primary-600 text-white'
                      : 'bg-surface-200 text-surface-700 hover:bg-surface-300'
                  )}
                >
                  {tag.name}
                </button>
              ))}
              {(!tagsData?.tags || tagsData.tags.length === 0) && (
                <p className="text-sm text-surface-400">No tags available</p>
              )}
            </div>
          </div>

          {/* Reviewers – default: project creator; changeable by owners/editors */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">
              Assign Reviewers <span className="text-surface-500 font-normal">(default: project creator)</span>
            </label>
            <div className="space-y-2 max-h-40 overflow-y-auto p-3 bg-surface-50 border border-surface-200 rounded-xl">
              {membersData?.members?.map((member) => (
                <label
                  key={member.user_id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-100 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedReviewers.includes(member.user_id)}
                    onChange={() => toggleReviewer(member.user_id)}
                    className="w-4 h-4 text-primary-600 border-surface-300 rounded focus:ring-primary-500"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-surface-900">{member.user_name}</p>
                    <p className="text-xs text-surface-500">{member.role}</p>
                  </div>
                </label>
              ))}
              {(!membersData?.members || membersData.members.length === 0) && (
                <p className="text-sm text-surface-400">No members available</p>
              )}
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">
              Status
            </label>
            <select
              {...register('status')}
              className="w-full h-11 px-4 bg-surface-50 border border-surface-200 rounded-xl text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all"
            >
              <option value="draft">Draft</option>
              <option value="review">In Review</option>
              <option value="published">Published</option>
            </select>
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
              disabled={uploadMutation.isPending || !selectedFile}
              className="px-5 py-2.5 bg-primary-600 text-white font-medium text-sm rounded-xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              {uploadMutation.isPending ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload size={16} />
                  Upload Document
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Add Member Modal
function AddMemberModal({ isOpen, onClose, projectId, existingMembers }) {
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUsers, setSelectedUsers] = useState({}) // { userId: role }

  // Fetch all users
  const { data: usersData, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersAPI.list(),
    enabled: isOpen,
  })

  const allUsers = usersData?.users || []

  // Filter out existing members and apply search
  const availableUsers = allUsers.filter(u => {
    const isExisting = existingMembers?.some(m => m.user_id === u.id) || false
    const matchesSearch = u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          u.email?.toLowerCase().includes(searchQuery.toLowerCase())
    return !isExisting && matchesSearch
  })

  // Add member mutation
  const addMemberMutation = useMutation({
    mutationFn: ({ userId, role }) =>
      projectsAPI.addMember(projectId, {
        project_id: projectId,
        user_id: userId,
        role,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-members', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project-stats', projectId] })
    },
  })

  const handleAddMembers = async () => {
    const userIds = Object.keys(selectedUsers)
    if (userIds.length === 0) {
      toast.error('Please select at least one user')
      return
    }

    try {
      for (const userId of userIds) {
        await addMemberMutation.mutateAsync({
          userId,
          role: selectedUsers[userId],
        })
      }
      toast.success(`Added ${userIds.length} member(s)`)
      setSelectedUsers({})
      setSearchQuery('')
      onClose()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add members')
    }
  }

  const toggleUser = (userId) => {
    setSelectedUsers(prev => {
      if (prev[userId]) {
        const { [userId]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [userId]: 'VIEWER' }
    })
  }

  const updateRole = (userId, role) => {
    setSelectedUsers(prev => ({ ...prev, [userId]: role }))
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-surface-900/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-modal w-full max-w-2xl animate-scale-in max-h-[600px] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100">
          <h2 className="text-lg font-semibold text-surface-900">Add Members</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-100 transition-colors">
            <X size={18} className="text-surface-500" />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          {/* Search */}
          <div className="mb-4 relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users by name or email..."
              className="w-full h-11 pl-11 pr-4 bg-surface-50 border border-surface-200 rounded-xl text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all"
            />
          </div>

          {/* Selected count */}
          {Object.keys(selectedUsers).length > 0 && (
            <div className="mb-4 px-4 py-2 bg-primary-50 border border-primary-200 rounded-lg text-sm text-primary-700">
              {Object.keys(selectedUsers).length} user(s) selected
            </div>
          )}

          {/* User List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={32} className="animate-spin text-primary-500" />
            </div>
          ) : availableUsers.length === 0 ? (
            <div className="text-center py-12">
              <Users size={48} className="mx-auto text-surface-300 mb-4" />
              <p className="text-surface-500">
                {searchQuery ? 'No users found matching your search' : 'No users available to add'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {availableUsers.map((user) => {
                const isSelected = !!selectedUsers[user.id]
                return (
                  <div
                    key={user.id}
                    className={clsx(
                      'flex items-center gap-4 p-3 rounded-xl border transition-all cursor-pointer',
                      isSelected
                        ? 'bg-primary-50 border-primary-300'
                        : 'bg-white border-surface-200 hover:border-surface-300'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleUser(user.id)}
                      className="w-4 h-4 text-primary-600 border-surface-300 rounded focus:ring-primary-500"
                    />

                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                      {user.full_name?.charAt(0) || 'U'}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-surface-900">{user.full_name || 'Unknown'}</p>
                      <p className="text-sm text-surface-500 truncate">{user.email}</p>
                    </div>

                    {isSelected && (
                      <select
                        value={selectedUsers[user.id]}
                        onChange={(e) => updateRole(user.id, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="px-3 py-1.5 bg-white border border-surface-200 rounded-lg text-sm font-medium text-surface-700 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
                      >
                        <option value="VIEWER">Viewer</option>
                        <option value="EDITOR">Editor</option>
                      </select>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-surface-100">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-medium text-surface-600 hover:text-surface-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAddMembers}
            disabled={addMemberMutation.isPending || Object.keys(selectedUsers).length === 0}
            className="px-5 py-2.5 bg-primary-600 text-white font-medium text-sm rounded-xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            {addMemberMutation.isPending ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <UserPlus size={16} />
                Add Members
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// Document Row
function DocumentRow({ document, projectId }) {
  const { user } = useAuthStore()

  const statusStyles = {
    draft: { bg: 'bg-surface-100', text: 'text-surface-600' },
    review: { bg: 'bg-accent-amber/10', text: 'text-accent-amber' },
    approved: { bg: 'bg-blue-100', text: 'text-blue-600' },
    published: { bg: 'bg-accent-green/10', text: 'text-accent-green' },
    archived: { bg: 'bg-gray-200', text: 'text-gray-500' },
  }

  const typeIcons = {
    guide: '📖',
    config: '⚙️',
    sop: '📋',
    report: '📊',
    diagram: '🎨',
    other: '📄',
  }

  const status = statusStyles[document.status] || statusStyles.draft
  const typeIcon = typeIcons[document.document_type] || typeIcons.other

  const formatFileSize = (bytes) => {
    if (!bytes) return ''
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const handleDownload = () => {
    // Use the API client helper which already handles token
    window.open(documentsAPI.download(document.id), '_blank')
  }

  return (
    <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4 p-4 sm:p-5 bg-white rounded-xl border border-surface-200 hover:shadow-hover hover:border-surface-300 transition-all group">
      {/* Document Icon */}
      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center flex-shrink-0 text-xl sm:text-2xl">
        {typeIcon}
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0 w-full">
        <div className="flex items-start gap-2 sm:gap-3 mb-2">
          <Link
            to={`/documents/${document.id}`}
            className="font-semibold text-sm sm:text-base text-surface-900 group-hover:text-primary-600 transition-colors line-clamp-2 sm:line-clamp-1 flex-1 break-words"
          >
            {document.title}
          </Link>

          {/* Status Badge */}
          <span className={clsx(
            'px-2 sm:px-2.5 py-0.5 sm:py-1 text-xs font-medium rounded-full capitalize flex-shrink-0',
            status.bg, status.text
          )}>
            {document.status}
          </span>
        </div>

        {/* Metadata Row */}
        <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-surface-500 flex-wrap">
          <span className="font-medium">v{document.version}</span>
          <span className="hidden sm:inline">•</span>
          <span className="truncate max-w-[120px] sm:max-w-xs">{document.file_name}</span>
          {document.file_size && (
            <>
              <span className="hidden sm:inline">•</span>
              <span className="hidden sm:inline">{formatFileSize(document.file_size)}</span>
            </>
          )}
          <span className="hidden sm:inline">•</span>
          <span className="flex items-center gap-1">
            <Clock size={12} className="sm:hidden" />
            <Clock size={14} className="hidden sm:inline" />
            <span className="hidden sm:inline">{formatDistanceToNow(new Date(document.uploaded_at), { addSuffix: true })}</span>
            <span className="sm:hidden">{formatDistanceToNow(new Date(document.uploaded_at), { addSuffix: true }).replace('about ', '').replace(' ago', '')}</span>
          </span>
        </div>

        {/* Tags */}
        {document.tags && document.tags.length > 0 && (
          <div className="flex items-center gap-1.5 sm:gap-2 mt-2 flex-wrap">
            {document.tags.slice(0, 2).map((tag) => (
              <span
                key={tag.id}
                className="px-1.5 sm:px-2 py-0.5 text-xs font-medium bg-primary-50 text-primary-700 rounded"
              >
                {tag.name}
              </span>
            ))}
            {document.tags.length > 2 && (
              <span className="text-xs text-surface-400">
                +{document.tags.length - 2}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0 self-start sm:self-auto">
        <Link
          to={`/documents/${document.id}`}
          className="p-1.5 sm:p-2 rounded-lg hover:bg-surface-100 transition-colors"
          title="View Details"
        >
          <Eye size={16} className="sm:hidden text-surface-500" />
          <Eye size={18} className="hidden sm:inline text-surface-500" />
        </Link>
        <button
          onClick={handleDownload}
          className="p-1.5 sm:p-2 rounded-lg hover:bg-surface-100 transition-colors"
          title="Download"
        >
          <Download size={16} className="sm:hidden text-surface-500" />
          <Download size={18} className="hidden sm:inline text-surface-500" />
        </button>
      </div>
    </div>
  )
}

// Project Settings Tab (edit project + danger zone)
function ProjectSettingsTab({ project, onUpdated, onArchived, onDeleted }) {
  const queryClient = useQueryClient()
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm({
    defaultValues: {
      name: project?.name ?? '',
      code: project?.code ?? '',
      brief: project?.brief ?? '',
      description: project?.description ?? '',
      status: (project?.status || 'active').toLowerCase(),
    },
    values: {
      name: project?.name ?? '',
      code: project?.code ?? '',
      brief: project?.brief ?? '',
      description: project?.description ?? '',
      status: (project?.status || 'active').toLowerCase(),
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data) => projectsAPI.update(project.id, {
      name: data.name,
      code: data.code,
      brief: data.brief || undefined,
      description: data.description || undefined,
      status: data.status?.toUpperCase?.(),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', project.id] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Project updated')
      onUpdated?.()
    },
    onError: (error) => toast.error(error.response?.data?.detail || 'Failed to update project'),
  })

  const archiveMutation = useMutation({
    mutationFn: () => projectsAPI.archive(project.id),
    onSuccess: () => {
      toast.success('Project archived')
      onArchived?.()
    },
    onError: (error) => toast.error(error.response?.data?.detail || 'Failed to archive'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => projectsAPI.delete(project.id),
    onSuccess: () => {
      toast.success('Project deleted')
      onDeleted?.()
    },
    onError: (error) => toast.error(error.response?.data?.detail || 'Failed to delete'),
  })

  const isArchived = project?.status === 'archived' || project?.status === 'ARCHIVED'

  return (
    <div className="space-y-6">
      {/* Edit project */}
      <div className="bg-white rounded-2xl border border-surface-200 p-6">
        <h3 className="font-semibold text-surface-900 mb-4">Project details</h3>
        <form onSubmit={handleSubmit((data) => updateMutation.mutate(data))} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">Project name</label>
            <input
              {...register('name', { required: 'Name is required' })}
              className="w-full h-11 px-4 bg-surface-50 border border-surface-200 rounded-xl text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
              placeholder="Project name"
            />
            {errors.name && <p className="mt-1 text-sm text-accent-red">{errors.name.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">Project code</label>
            <input
              {...register('code', {
                required: 'Code is required',
                pattern: { value: /^[A-Z0-9_-]+$/i, message: 'Letters, numbers, dashes and underscores only' },
                minLength: { value: 2, message: 'At least 2 characters' },
                maxLength: { value: 20, message: 'At most 20 characters' },
              })}
              className="w-full h-11 px-4 bg-surface-50 border border-surface-200 rounded-xl text-surface-900 font-mono uppercase focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
              placeholder="e.g. PROJ-01"
            />
            {errors.code && <p className="mt-1 text-sm text-accent-red">{errors.code.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">Brief summary</label>
            <input
              {...register('brief', { maxLength: { value: 500, message: 'Max 500 characters' } })}
              className="w-full h-11 px-4 bg-surface-50 border border-surface-200 rounded-xl text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
              placeholder="Short summary"
            />
            {errors.brief && <p className="mt-1 text-sm text-accent-red">{errors.brief.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">Description</label>
            <textarea
              {...register('description')}
              rows={4}
              className="w-full px-4 py-3 bg-surface-50 border border-surface-200 rounded-xl text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 resize-none"
              placeholder="Full description"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">Status</label>
            <select
              {...register('status')}
              className="w-full h-11 px-4 bg-surface-50 border border-surface-200 rounded-xl text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
            >
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={updateMutation.isPending || !isDirty}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white font-medium rounded-xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {updateMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              Save changes
            </button>
          </div>
        </form>
      </div>

      {/* Danger zone */}
      <div className="bg-white rounded-2xl border border-red-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle size={20} className="text-accent-red" />
          <h3 className="font-semibold text-surface-900">Danger zone</h3>
        </div>
        <p className="text-sm text-surface-500 mb-4">
          Archive or delete this project. Archived projects can be restored from the Projects list.
        </p>
        <div className="flex flex-wrap gap-3">
          {!isArchived ? (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Archive this project? You can restore it from the Projects page.')) {
                  archiveMutation.mutate()
                }
              }}
              disabled={archiveMutation.isPending}
              className="px-4 py-2.5 border border-amber-300 text-amber-700 font-medium rounded-xl hover:bg-amber-50 disabled:opacity-50 transition-colors"
            >
              {archiveMutation.isPending ? <Loader2 size={16} className="animate-spin inline" /> : 'Archive project'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Restore this project?')) {
                  projectsAPI.restore(project.id).then(() => {
                    queryClient.invalidateQueries({ queryKey: ['project', project.id] })
                    queryClient.invalidateQueries({ queryKey: ['projects'] })
                    toast.success('Project restored')
                    onUpdated?.()
                  }).catch((err) => toast.error(err.response?.data?.detail || 'Failed to restore'))
                }
              }}
              className="px-4 py-2.5 border border-accent-green text-accent-green font-medium rounded-xl hover:bg-green-50 transition-colors"
            >
              Restore project
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Permanently delete this project and all its documents? This cannot be undone.')) {
                deleteMutation.mutate()
              }
            }}
            disabled={deleteMutation.isPending}
            className="px-4 py-2.5 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {deleteMutation.isPending ? <Loader2 size={16} className="animate-spin inline" /> : 'Delete project'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Member Row
function MemberRow({ member, isOwner, onUpdateRole, onRemove, isOnline = false }) {
  const [menuOpen, setMenuOpen] = useState(false)
  
  const roleColors = {
    OWNER: 'bg-amber-100 text-amber-700',
    EDITOR: 'bg-primary-100 text-primary-700',
    VIEWER: 'bg-surface-100 text-surface-600',
  }

  const userForAvatar = {
    full_name: member.user_name,
    user_name: member.user_name,
    email: member.user_email,
  }

  return (
    <div className="flex items-center gap-4 p-4 bg-white rounded-xl border border-surface-200 group">
      <UserAvatarWithStatus user={userForAvatar} isOnline={isOnline} size="md" showStatus />
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-surface-900">{member.user_name || 'Unknown'}</p>
          {member.role === 'OWNER' && (
            <Crown size={14} className="text-amber-500" />
          )}
        </div>
        <p className="text-sm text-surface-500">{member.user_email}</p>
      </div>

      <span className={clsx(
        'px-2.5 py-1 text-xs font-medium rounded-full',
        roleColors[member.role] || roleColors.VIEWER
      )}>
        {member.role}
      </span>

      {isOwner && member.role !== 'OWNER' && (
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2 rounded-lg hover:bg-surface-100 transition-colors opacity-0 group-hover:opacity-100"
          >
            <MoreVertical size={16} className="text-surface-400" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 mt-1 w-40 bg-white rounded-xl shadow-modal border border-surface-200 py-1 z-20 animate-slide-down">
                <button
                  onClick={() => {
                    onUpdateRole(member.user_id, 'EDITOR')
                    setMenuOpen(false)
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-surface-600 hover:bg-surface-50"
                >
                  <Edit3 size={14} />
                  Make Editor
                </button>
                <button
                  onClick={() => {
                    onUpdateRole(member.user_id, 'VIEWER')
                    setMenuOpen(false)
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-surface-600 hover:bg-surface-50"
                >
                  <Eye size={14} />
                  Make Viewer
                </button>
                <button
                  onClick={() => {
                    onRemove(member.user_id)
                    setMenuOpen(false)
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-accent-red hover:bg-red-50"
                >
                  <Trash2 size={14} />
                  Remove
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function ProjectDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  
  const [activeTab, setActiveTab] = useState('documents')
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false)

  // Fetch project
  const { data: project, isLoading, error } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectsAPI.get(id),
  })

  // Fetch members
  const { data: members = [] } = useQuery({
    queryKey: ['project-members', id],
    queryFn: () => projectsAPI.getMembers(id),
    enabled: !!project,
  })

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['project-stats', id],
    queryFn: () => projectsAPI.getStats(id),
    enabled: !!project,
  })

  // Fetch documents
  const { data: documents = [] } = useQuery({
    queryKey: ['project-documents', id],
    queryFn: () => documentsAPI.listByProject(id),
    enabled: !!project,
  })

  // Fetch online users for member status in Members tab
  const { data: onlineUsersData } = useQuery({
    queryKey: ['online-users'],
    queryFn: () => adminAPI.getOnlineUsers(5),
    refetchInterval: 20000,
    staleTime: 10000,
  })
  const onlineUserIds = (onlineUsersData?.online_users || []).map(u => u.id)

  // Check if user is owner
  const isOwner = members.some(m => m.user_id === user?.id && m.role === 'OWNER') || user?.role === 'ADMIN'

  // Check if user is a member (can upload documents)
  const isMember = members.some(m => m.user_id === user?.id) || user?.role === 'ADMIN'

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }) => projectsAPI.updateMemberRole(id, userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-members', id] })
      toast.success('Member role updated')
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to update role')
    },
  })

  // Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: (userId) => projectsAPI.removeMember(id, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-members', id] })
      toast.success('Member removed')
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to remove member')
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} className="animate-spin text-primary-500" />
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="text-center py-12">
        <p className="text-accent-red">Failed to load project</p>
        <button
          onClick={() => navigate('/projects')}
          className="mt-4 text-primary-600 hover:underline"
        >
          Back to projects
        </button>
      </div>
    )
  }

  const tabs = [
    { id: 'documents', label: 'Documents', count: stats?.total_documents || 0 },
    { id: 'members', label: 'Members', count: members.length },
    { id: 'discussion', label: 'Discussion' },
  ]

  if (isOwner) {
    tabs.push({ id: 'settings', label: 'Settings' })
  }

  return (
    <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6 px-4 sm:px-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
        <button
          onClick={() => navigate('/projects')}
          className="self-start p-2 rounded-lg hover:bg-surface-100 transition-colors sm:mt-1"
        >
          <ArrowLeft size={20} className="text-surface-500" />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 sm:gap-3 mb-1 flex-wrap">
            <span className="text-xs sm:text-sm font-mono text-surface-400 bg-surface-100 px-2 py-0.5 rounded">
              {project.code}
            </span>
            <span className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-accent-green/10 text-accent-green">
              {project.status || 'ACTIVE'}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-surface-900 break-words">{project.name}</h1>
          {project.brief && (
            <p className="text-sm sm:text-base text-surface-500 mt-1 break-words">{project.brief}</p>
          )}
        </div>

        {isMember && (
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white font-medium rounded-xl hover:bg-primary-700 transition-colors w-full sm:w-auto"
          >
            <Upload size={18} />
            <span className="sm:inline">Upload Document</span>
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: 'Total Documents', value: stats?.total_documents || 0 },
          { label: 'Published', value: stats?.published_documents || 0 },
          { label: 'In Draft', value: stats?.draft_documents || 0 },
          { label: 'Members', value: stats?.total_members || members.length },
        ].map((stat, i) => (
          <div key={i} className="bg-white rounded-xl border border-surface-200 p-3 sm:p-4">
            <p className="text-xl sm:text-2xl font-bold text-surface-900">{stat.value}</p>
            <p className="text-xs sm:text-sm text-surface-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b border-surface-200 -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-4 sm:gap-6 overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap',
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-surface-500 hover:text-surface-700'
              )}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className={clsx(
                  'px-2 py-0.5 text-xs rounded-full',
                  activeTab === tab.id
                    ? 'bg-primary-100 text-primary-600'
                    : 'bg-surface-100 text-surface-500'
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="min-h-[300px]">
        {activeTab === 'documents' && (
          <div className="space-y-3">
            {documents.length === 0 ? (
              <div className="bg-white rounded-2xl border border-surface-200 p-12 text-center">
                <FileText size={48} className="mx-auto text-surface-300 mb-4" />
                <h3 className="font-semibold text-surface-700 mb-2">No documents yet</h3>
                <p className="text-surface-500 mb-4">
                  Upload your first document to get started
                </p>
                {isMember && (
                  <button
                    onClick={() => setIsUploadModalOpen(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    <Upload size={16} />
                    Upload Document
                  </button>
                )}
              </div>
            ) : (
              documents.map((doc) => (
                <DocumentRow key={doc.id} document={doc} projectId={id} />
              ))
            )}
          </div>
        )}

        {activeTab === 'members' && (
          <div className="space-y-3">
            {isOwner && (
              <div className="flex justify-end mb-4">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setIsAddMemberModalOpen(true)
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white font-medium rounded-xl hover:bg-primary-700 transition-colors"
                >
                  <UserPlus size={18} />
                  Add Member
                </button>
              </div>
            )}

            {members.length === 0 ? (
              <div className="text-center py-12">
                <Users size={48} className="mx-auto text-surface-300 mb-4" />
                <p className="text-surface-500">No team members</p>
              </div>
            ) : (
              members.map((member) => (
                <MemberRow
                  key={member.id}
                  member={member}
                  isOwner={isOwner}
                  isOnline={onlineUserIds.includes(member.user_id)}
                  onUpdateRole={(userId, role) => updateRoleMutation.mutate({ userId, role })}
                  onRemove={(userId) => {
                    if (window.confirm('Remove this member from the project?')) {
                      removeMemberMutation.mutate(userId)
                    }
                  }}
                />
              ))
            )}
          </div>
        )}

        {activeTab === 'discussion' && (
          <ProjectCommentsSection projectId={id} />
        )}

        {activeTab === 'settings' && (
          <ProjectSettingsTab
            project={project}
            onUpdated={() => {
              queryClient.invalidateQueries({ queryKey: ['project', id] })
              queryClient.invalidateQueries({ queryKey: ['project-stats', id] })
            }}
            onArchived={() => navigate('/projects')}
            onDeleted={() => navigate('/projects')}
          />
        )}
      </div>

      {/* Upload Modal */}
      <UploadDocumentModal
        isOpen={isUploadModalOpen}
        project={project}
        onClose={() => setIsUploadModalOpen(false)}
        projectId={id}
      />

      {/* Add Member Modal */}
      <AddMemberModal
        isOpen={isAddMemberModalOpen}
        onClose={() => setIsAddMemberModalOpen(false)}
        projectId={id}
        existingMembers={members}
      />
    </div>
  )
}

export default ProjectDetail
