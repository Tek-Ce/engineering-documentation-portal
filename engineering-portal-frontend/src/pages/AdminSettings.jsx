import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../store/authStore'
import { useNavigate } from 'react-router-dom'
import { tagsAPI, projectsAPI, usersAPI, adminAPI } from '../api/client'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'
import {
  Settings,
  Tag,
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  Users,
  FolderKanban,
  Shield,
  AlertTriangle,
  Activity,
  Circle,
  Clock,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'

function AdminSettings() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('tags')
  const [isCreating, setIsCreating] = useState(false)
  const [editingTag, setEditingTag] = useState(null)
  const [newTag, setNewTag] = useState({ name: '', color: '#3B82F6' })

  // Activity logs state
  const [logsPage, setLogsPage] = useState(0)
  const [logsFilter, setLogsFilter] = useState({ action: '', user_id: '' })

  // Check if user is admin
  if (user?.role !== 'ADMIN') {
    navigate('/')
    return null
  }

  // Fetch tags
  const { data: tagsData, isLoading: tagsLoading } = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagsAPI.list(),
  })

  // Fetch all users (admin only)
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['all-users-admin'],
    queryFn: () => usersAPI.list(),
    enabled: activeTab === 'users',
  })

  // Fetch all projects (admin only)
  const { data: projectsData, isLoading: projectsLoading } = useQuery({
    queryKey: ['all-projects-admin'],
    queryFn: () => projectsAPI.list({ limit: 1000 }),
    enabled: activeTab === 'projects',
  })

  // Fetch activity logs (admin only)
  const { data: activityLogsData, isLoading: logsLoading, refetch: refetchLogs } = useQuery({
    queryKey: ['activity-logs', logsPage, logsFilter],
    queryFn: () => adminAPI.getActivityLogs({
      skip: logsPage * 50,
      limit: 50,
      ...(logsFilter.action && { action: logsFilter.action }),
      ...(logsFilter.user_id && { user_id: logsFilter.user_id })
    }),
    enabled: activeTab === 'activity',
  })

  // Fetch activity stats (admin only)
  const { data: activityStats } = useQuery({
    queryKey: ['activity-stats'],
    queryFn: () => adminAPI.getActivityStats(30),
    enabled: activeTab === 'activity',
  })

  // Fetch users with online status
  const { data: usersStatusData, isLoading: usersStatusLoading, refetch: refetchUsersStatus } = useQuery({
    queryKey: ['users-status'],
    queryFn: () => adminAPI.getUsersWithStatus({ limit: 200 }),
    enabled: activeTab === 'online',
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  // Create tag mutation
  const createTagMutation = useMutation({
    mutationFn: (data) => tagsAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] })
      toast.success('Tag created successfully')
      setNewTag({ name: '', color: '#3B82F6' })
      setIsCreating(false)
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to create tag')
    },
  })

  // Update tag mutation
  const updateTagMutation = useMutation({
    mutationFn: ({ id, data }) => tagsAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] })
      toast.success('Tag updated successfully')
      setEditingTag(null)
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to update tag')
    },
  })

  // Delete tag mutation
  const deleteTagMutation = useMutation({
    mutationFn: (id) => tagsAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] })
      toast.success('Tag deleted successfully')
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to delete tag')
    },
  })

  // Reset database mutation
  const resetDatabaseMutation = useMutation({
    mutationFn: () => adminAPI.resetDatabase(),
    onSuccess: (data) => {
      toast.success(data.message || 'Database reset successfully')
      // Invalidate all queries to refresh data
      queryClient.invalidateQueries()
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to reset database')
    },
  })

  const handleCreateTag = () => {
    if (!newTag.name.trim()) {
      toast.error('Tag name is required')
      return
    }
    createTagMutation.mutate(newTag)
  }

  const handleUpdateTag = (tag) => {
    if (!tag.name.trim()) {
      toast.error('Tag name is required')
      return
    }
    updateTagMutation.mutate({ id: tag.id, data: { name: tag.name, color: tag.color } })
  }

  const handleDeleteTag = (tagId, tagName) => {
    if (window.confirm(`Are you sure you want to delete the tag "${tagName}"? This will remove it from all documents.`)) {
      deleteTagMutation.mutate(tagId)
    }
  }

  const handleResetDatabase = () => {
    const confirmed = window.confirm(
      '⚠️ WARNING: This will permanently delete ALL data in the system except the default admin user.\n\n' +
      'This action CANNOT be undone!\n\n' +
      'Are you absolutely sure you want to continue?'
    )

    if (confirmed) {
      const doubleConfirm = window.confirm(
        '🚨 FINAL WARNING: You are about to delete:\n' +
        '• All projects\n' +
        '• All documents\n' +
        '• All comments\n' +
        '• All notifications\n' +
        '• All users (except default admin)\n' +
        '• All tags\n' +
        '• All activity logs\n\n' +
        'Type YES to proceed.'
      )

      if (doubleConfirm) {
        resetDatabaseMutation.mutate()
      }
    }
  }

  const tabs = [
    { id: 'tags', label: 'Tags', icon: Tag },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'online', label: 'Online Status', icon: Circle },
    { id: 'activity', label: 'Activity Logs', icon: Activity },
    { id: 'projects', label: 'Projects', icon: FolderKanban },
    { id: 'danger', label: 'Danger Zone', icon: AlertTriangle },
  ]

  const tags = tagsData?.tags || []
  const users = usersData?.users || []
  const projects = projectsData?.projects || []

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center">
          <Settings className="text-white" size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Admin Settings</h1>
          <p className="text-surface-500 text-sm">Manage system-wide configuration and data</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-surface-200">
        <div className="border-b border-surface-200">
          <div className="flex gap-1 p-2">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all ${
                    activeTab === tab.id
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-surface-600 hover:bg-surface-50'
                  }`}
                >
                  <Icon size={18} />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* Tags Management */}
          {activeTab === 'tags' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-surface-900">System Tags</h2>
                  <p className="text-sm text-surface-500 mt-1">
                    Manage global tags that can be used across all documents
                  </p>
                </div>
                {!isCreating && (
                  <button
                    onClick={() => setIsCreating(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    <Plus size={18} />
                    New Tag
                  </button>
                )}
              </div>

              {/* Create Tag Form */}
              {isCreating && (
                <div className="bg-surface-50 rounded-lg p-4 border border-surface-200">
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={newTag.name}
                      onChange={(e) => setNewTag({ ...newTag, name: e.target.value })}
                      placeholder="Tag name"
                      className="flex-1 px-3 py-2 border border-surface-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                    <input
                      type="color"
                      value={newTag.color}
                      onChange={(e) => setNewTag({ ...newTag, color: e.target.value })}
                      className="w-16 h-10 rounded-lg border border-surface-300 cursor-pointer"
                    />
                    <button
                      onClick={handleCreateTag}
                      disabled={createTagMutation.isPending}
                      className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                    >
                      <Save size={18} />
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setIsCreating(false)
                        setNewTag({ name: '', color: '#3B82F6' })
                      }}
                      className="p-2 text-surface-500 hover:text-surface-700 rounded-lg hover:bg-surface-200"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>
              )}

              {/* Tags List */}
              {tagsLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
                </div>
              ) : tags.length === 0 ? (
                <div className="text-center py-12 bg-surface-50 rounded-lg">
                  <Tag className="mx-auto text-surface-300 mb-3" size={48} />
                  <p className="text-surface-500">No tags created yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {tags.map((tag) => (
                    <div
                      key={tag.id}
                      className="bg-white border border-surface-200 rounded-lg p-4 hover:shadow-md transition-all"
                    >
                      {editingTag?.id === tag.id ? (
                        <div className="space-y-3">
                          <input
                            type="text"
                            value={editingTag.name}
                            onChange={(e) => setEditingTag({ ...editingTag, name: e.target.value })}
                            className="w-full px-3 py-2 border border-surface-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          />
                          <input
                            type="color"
                            value={editingTag.color}
                            onChange={(e) => setEditingTag({ ...editingTag, color: e.target.value })}
                            className="w-full h-10 rounded-lg border border-surface-300 cursor-pointer"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleUpdateTag(editingTag)}
                              disabled={updateTagMutation.isPending}
                              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                            >
                              <Save size={16} />
                              Save
                            </button>
                            <button
                              onClick={() => setEditingTag(null)}
                              className="px-3 py-2 border border-surface-300 rounded-lg hover:bg-surface-50"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between mb-3">
                            <span
                              className="px-3 py-1.5 rounded-full text-white text-sm font-medium"
                              style={{ backgroundColor: tag.color }}
                            >
                              {tag.name}
                            </span>
                            <div className="flex gap-1">
                              <button
                                onClick={() => setEditingTag(tag)}
                                className="p-1.5 text-surface-500 hover:text-primary-600 rounded hover:bg-surface-100"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                onClick={() => handleDeleteTag(tag.id, tag.name)}
                                className="p-1.5 text-surface-500 hover:text-red-600 rounded hover:bg-surface-100"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                          <div className="text-xs text-surface-500">
                            Created {new Date(tag.created_at).toLocaleDateString()}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Users Management */}
          {activeTab === 'users' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-surface-900">System Users</h2>
                <p className="text-sm text-surface-500 mt-1">
                  Overview of all users in the system
                </p>
              </div>

              {usersLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-surface-200">
                        <th className="text-left py-3 px-4 text-sm font-semibold text-surface-700">User</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-surface-700">Email</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-surface-700">Role</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-surface-700">Status</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-surface-700">Last Login</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => (
                        <tr key={user.id} className="border-b border-surface-100 hover:bg-surface-50">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-xs font-bold">
                                {user.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || '?'}
                              </div>
                              <span className="font-medium text-surface-900">{user.full_name}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-surface-600">{user.email}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                              user.role === 'ADMIN'
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-surface-100 text-surface-700'
                            }`}>
                              {user.role === 'ADMIN' && <Shield size={12} className="inline mr-1" />}
                              {user.role}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                              user.is_active
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {user.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-surface-600 text-sm">
                            {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Projects Overview */}
          {/* Online Status Tab */}
          {activeTab === 'online' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-surface-900">User Online Status</h2>
                  <p className="text-sm text-surface-500 mt-1">
                    See which users are currently active in the system
                  </p>
                </div>
                <button
                  onClick={() => refetchUsersStatus()}
                  className="flex items-center gap-2 px-3 py-2 text-sm bg-surface-100 text-surface-700 rounded-lg hover:bg-surface-200 transition-colors"
                >
                  <RefreshCw size={16} />
                  Refresh
                </button>
              </div>

              {/* Online Summary */}
              {usersStatusData && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <Circle size={12} className="fill-green-500 text-green-500" />
                      <span className="text-2xl font-bold text-green-700">{usersStatusData.online_count}</span>
                    </div>
                    <p className="text-sm text-green-600">Online Now</p>
                  </div>
                  <div className="bg-surface-50 border border-surface-200 rounded-lg p-4 text-center">
                    <span className="text-2xl font-bold text-surface-700">{usersStatusData.total}</span>
                    <p className="text-sm text-surface-500">Total Users</p>
                  </div>
                </div>
              )}

              {/* Users List */}
              {usersStatusLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-surface-200">
                        <th className="text-left py-3 px-4 text-sm font-semibold text-surface-700">Status</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-surface-700">User</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-surface-700">Email</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-surface-700">Role</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-surface-700">Last Activity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usersStatusData?.users?.map((u) => (
                        <tr key={u.id} className="border-b border-surface-100 hover:bg-surface-50">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <Circle
                                size={10}
                                className={u.is_online ? 'fill-green-500 text-green-500' : 'fill-surface-300 text-surface-300'}
                              />
                              <span className={`text-xs font-medium ${u.is_online ? 'text-green-600' : 'text-surface-500'}`}>
                                {u.is_online ? 'Online' : 'Offline'}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                                u.is_online ? 'bg-gradient-to-br from-green-500 to-green-700' : 'bg-gradient-to-br from-surface-400 to-surface-600'
                              }`}>
                                {u.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || '?'}
                              </div>
                              <span className="font-medium text-surface-900">{u.full_name}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-surface-600">{u.email}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                              u.role === 'ADMIN'
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-surface-100 text-surface-700'
                            }`}>
                              {u.role === 'ADMIN' && <Shield size={12} className="inline mr-1" />}
                              {u.role}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-surface-600 text-sm">
                            {u.last_activity ? (
                              <span className="flex items-center gap-1.5">
                                <Clock size={14} className="text-surface-400" />
                                {formatDistanceToNow(new Date(u.last_activity), { addSuffix: true })}
                              </span>
                            ) : (
                              <span className="text-surface-400">Never</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Activity Logs Tab */}
          {activeTab === 'activity' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-surface-900">Activity Logs</h2>
                  <p className="text-sm text-surface-500 mt-1">
                    Track all user activities in the system
                  </p>
                </div>
                <button
                  onClick={() => refetchLogs()}
                  className="flex items-center gap-2 px-3 py-2 text-sm bg-surface-100 text-surface-700 rounded-lg hover:bg-surface-200 transition-colors"
                >
                  <RefreshCw size={16} />
                  Refresh
                </button>
              </div>

              {/* Stats Summary */}
              {activityStats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 text-center">
                    <span className="text-2xl font-bold text-primary-700">{activityStats.total_logs}</span>
                    <p className="text-sm text-primary-600">Total Logs</p>
                  </div>
                  <div className="bg-surface-50 border border-surface-200 rounded-lg p-4 text-center">
                    <span className="text-2xl font-bold text-surface-700">{activityStats.actions?.length || 0}</span>
                    <p className="text-sm text-surface-500">Action Types</p>
                  </div>
                  <div className="bg-surface-50 border border-surface-200 rounded-lg p-4 text-center">
                    <span className="text-2xl font-bold text-surface-700">{activityStats.user_stats?.length || 0}</span>
                    <p className="text-sm text-surface-500">Active Users (30d)</p>
                  </div>
                  <div className="bg-surface-50 border border-surface-200 rounded-lg p-4 text-center">
                    <span className="text-2xl font-bold text-surface-700">{activityStats.resource_types?.length || 0}</span>
                    <p className="text-sm text-surface-500">Resource Types</p>
                  </div>
                </div>
              )}

              {/* Filters */}
              <div className="flex flex-wrap gap-3 items-center bg-surface-50 p-4 rounded-lg">
                <Filter size={18} className="text-surface-500" />
                <select
                  value={logsFilter.action}
                  onChange={(e) => {
                    setLogsFilter({ ...logsFilter, action: e.target.value })
                    setLogsPage(0)
                  }}
                  className="px-3 py-2 border border-surface-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">All Actions</option>
                  {activityStats?.actions?.map((action) => (
                    <option key={action} value={action}>{action}</option>
                  ))}
                </select>
                {logsFilter.action && (
                  <button
                    onClick={() => {
                      setLogsFilter({ action: '', user_id: '' })
                      setLogsPage(0)
                    }}
                    className="px-3 py-2 text-sm text-surface-600 hover:text-surface-900"
                  >
                    Clear Filters
                  </button>
                )}
              </div>

              {/* Logs Table */}
              {logsLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
                </div>
              ) : activityLogsData?.logs?.length === 0 ? (
                <div className="text-center py-12 bg-surface-50 rounded-lg">
                  <Activity className="mx-auto text-surface-300 mb-3" size={48} />
                  <p className="text-surface-500">No activity logs found</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-surface-200">
                          <th className="text-left py-3 px-4 text-sm font-semibold text-surface-700">Time</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-surface-700">User</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-surface-700">Action</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-surface-700">Resource</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-surface-700">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activityLogsData?.logs?.map((log) => (
                          <tr key={log.id} className="border-b border-surface-100 hover:bg-surface-50">
                            <td className="py-3 px-4 text-sm text-surface-600">
                              <span className="flex items-center gap-1.5">
                                <Clock size={14} className="text-surface-400" />
                                {log.created_at ? formatDistanceToNow(new Date(log.created_at), { addSuffix: true }) : '-'}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-xs font-bold">
                                  {log.user_name?.split(' ').map(n => n[0]).join('').toUpperCase() || '?'}
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-surface-900">{log.user_name || 'Unknown'}</p>
                                  <p className="text-xs text-surface-500">{log.user_email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-700">
                                {log.action}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              {log.resource_type ? (
                                <span className="text-sm text-surface-600">
                                  {log.resource_type}
                                  {log.project_name && (
                                    <span className="text-surface-400 ml-1">({log.project_name})</span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-surface-400">-</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-sm text-surface-600 max-w-xs truncate">
                              {log.description || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  <div className="flex items-center justify-between pt-4 border-t border-surface-200">
                    <p className="text-sm text-surface-500">
                      Showing {logsPage * 50 + 1} - {Math.min((logsPage + 1) * 50, activityLogsData?.total || 0)} of {activityLogsData?.total || 0}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setLogsPage(Math.max(0, logsPage - 1))}
                        disabled={logsPage === 0}
                        className="flex items-center gap-1 px-3 py-2 text-sm border border-surface-300 rounded-lg hover:bg-surface-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft size={16} />
                        Previous
                      </button>
                      <button
                        onClick={() => setLogsPage(logsPage + 1)}
                        disabled={(logsPage + 1) * 50 >= (activityLogsData?.total || 0)}
                        className="flex items-center gap-1 px-3 py-2 text-sm border border-surface-300 rounded-lg hover:bg-surface-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Projects Overview */}
          {activeTab === 'projects' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-surface-900">All Projects</h2>
                <p className="text-sm text-surface-500 mt-1">
                  Overview of all projects in the system
                </p>
              </div>

              {projectsLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {projects.map((project) => (
                    <div
                      key={project.id}
                      className="bg-white border border-surface-200 rounded-lg p-4 hover:shadow-md transition-all"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="font-semibold text-surface-900 line-clamp-1">{project.name}</h3>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          project.status === 'ACTIVE'
                            ? 'bg-green-100 text-green-700'
                            : project.status === 'COMPLETED'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-surface-200 text-surface-600'
                        }`}>
                          {project.status}
                        </span>
                      </div>
                      <p className="text-sm text-surface-600 line-clamp-2 mb-3">
                        {project.brief || project.description || 'No description'}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-surface-500">
                        <span>{project.document_count || 0} docs</span>
                        <span>•</span>
                        <span>Code: {project.code}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Danger Zone */}
          {activeTab === 'danger' && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="text-red-600" size={24} />
                <div>
                  <h2 className="text-lg font-semibold text-red-600">Danger Zone</h2>
                  <p className="text-sm text-surface-500 mt-1">
                    Destructive actions that cannot be undone
                  </p>
                </div>
              </div>

              {/* Reset Database Card */}
              <div className="border-2 border-red-300 rounded-lg p-6 bg-red-50">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="text-red-600" size={24} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-red-900 mb-2">
                      Reset Database
                    </h3>
                    <p className="text-sm text-red-800 mb-4">
                      Permanently delete all data in the system except the default admin user (admin@engportal.local).
                      This will remove all projects, documents, comments, notifications, users, tags, and activity logs.
                    </p>
                    <div className="bg-white border border-red-200 rounded-lg p-4 mb-4">
                      <p className="text-sm font-semibold text-red-900 mb-2">⚠️ This action will delete:</p>
                      <ul className="text-sm text-red-800 space-y-1 ml-4">
                        <li>• All projects and their documents</li>
                        <li>• All comments and discussions</li>
                        <li>• All notifications</li>
                        <li>• All users (except default admin)</li>
                        <li>• All custom tags</li>
                        <li>• All activity logs</li>
                      </ul>
                    </div>
                    <button
                      onClick={handleResetDatabase}
                      disabled={resetDatabaseMutation.isPending}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                      <AlertTriangle size={18} />
                      {resetDatabaseMutation.isPending ? 'Resetting Database...' : 'Reset Database'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AdminSettings
