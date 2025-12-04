import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import {
  Users,
  Plus,
  Search,
  MoreVertical,
  Edit3,
  UserX,
  UserCheck,
  X,
  Loader2,
  Shield,
  Crown,
  Eye
} from 'lucide-react'
import { usersAPI } from '../api/client'
import { formatDistanceToNow } from 'date-fns'
import clsx from 'clsx'

// Create User Modal
function CreateUserModal({ isOpen, onClose }) {
  const queryClient = useQueryClient()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      full_name: '',
      email: '',
      password: '',
      role: 'VIEWER',
    },
  })

  const createMutation = useMutation({
    mutationFn: usersAPI.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('User created successfully!')
      reset()
      onClose()
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to create user')
    },
  })

  const onSubmit = (data) => {
    createMutation.mutate(data)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-surface-900/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-white rounded-2xl shadow-modal w-full max-w-lg animate-scale-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100">
          <h2 className="text-lg font-semibold text-surface-900">Create New User</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-100 transition-colors">
            <X size={18} className="text-surface-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">
              Full Name <span className="text-accent-red">*</span>
            </label>
            <input
              {...register('full_name', { required: 'Full name is required' })}
              className="w-full h-11 px-4 bg-surface-50 border border-surface-200 rounded-xl text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all"
              placeholder="John Doe"
            />
            {errors.full_name && (
              <p className="mt-1.5 text-sm text-accent-red">{errors.full_name.message}</p>
            )}
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">
              Email <span className="text-accent-red">*</span>
            </label>
            <input
              type="email"
              {...register('email', { 
                required: 'Email is required',
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: 'Invalid email address',
                }
              })}
              className="w-full h-11 px-4 bg-surface-50 border border-surface-200 rounded-xl text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all"
              placeholder="john@company.com"
            />
            {errors.email && (
              <p className="mt-1.5 text-sm text-accent-red">{errors.email.message}</p>
            )}
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">
              Password <span className="text-accent-red">*</span>
            </label>
            <input
              type="password"
              {...register('password', { 
                required: 'Password is required',
                minLength: { value: 8, message: 'Password must be at least 8 characters' }
              })}
              className="w-full h-11 px-4 bg-surface-50 border border-surface-200 rounded-xl text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all"
              placeholder="••••••••"
            />
            {errors.password && (
              <p className="mt-1.5 text-sm text-accent-red">{errors.password.message}</p>
            )}
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">
              Role
            </label>
            <select
              {...register('role')}
              className="w-full h-11 px-4 bg-surface-50 border border-surface-200 rounded-xl text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all"
            >
              <option value="VIEWER">Viewer</option>
              <option value="ENGINEER">Engineer</option>
              <option value="ADMIN">Admin</option>
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
              disabled={createMutation.isPending}
              className="px-5 py-2.5 bg-primary-600 text-white font-medium text-sm rounded-xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus size={16} />
                  Create User
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// User Row
function UserRow({ user, onToggleActive }) {
  const [menuOpen, setMenuOpen] = useState(false)
  
  const roleConfig = {
    ADMIN: { icon: Crown, color: 'bg-amber-100 text-amber-700', label: 'Admin' },
    ENGINEER: { icon: Shield, color: 'bg-primary-100 text-primary-700', label: 'Engineer' },
    VIEWER: { icon: Eye, color: 'bg-surface-100 text-surface-600', label: 'Viewer' },
  }

  const role = roleConfig[user.role] || roleConfig.VIEWER
  const RoleIcon = role.icon

  return (
    <div className="flex items-center gap-4 p-4 bg-white rounded-xl border border-surface-200 hover:shadow-hover transition-all group">
      <div className={clsx(
        'w-11 h-11 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0',
        user.is_active 
          ? 'bg-gradient-to-br from-primary-500 to-primary-700' 
          : 'bg-surface-300'
      )}>
        {user.full_name?.charAt(0) || 'U'}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={clsx(
            'font-medium',
            user.is_active ? 'text-surface-900' : 'text-surface-400'
          )}>
            {user.full_name}
          </p>
          {!user.is_active && (
            <span className="px-2 py-0.5 bg-red-100 text-accent-red text-xs font-medium rounded-full">
              Inactive
            </span>
          )}
        </div>
        <p className="text-sm text-surface-500">{user.email}</p>
      </div>

      <div className={clsx(
        'px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5',
        role.color
      )}>
        <RoleIcon size={12} />
        {role.label}
      </div>

      <div className="text-sm text-surface-400 hidden md:block min-w-[140px] text-right">
        {user.last_login 
          ? formatDistanceToNow(new Date(user.last_login), { addSuffix: true })
          : 'Never logged in'
        }
      </div>

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
            <div className="absolute right-0 mt-1 w-44 bg-white rounded-xl shadow-modal border border-surface-200 py-1 z-20 animate-slide-down">
              <button
                onClick={() => {
                  onToggleActive(user.id, user.is_active)
                  setMenuOpen(false)
                }}
                className={clsx(
                  'w-full flex items-center gap-2 px-4 py-2 text-sm',
                  user.is_active 
                    ? 'text-accent-red hover:bg-red-50' 
                    : 'text-accent-green hover:bg-green-50'
                )}
              >
                {user.is_active ? (
                  <>
                    <UserX size={14} />
                    Deactivate
                  </>
                ) : (
                  <>
                    <UserCheck size={14} />
                    Activate
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function AdminUsers() {
  const queryClient = useQueryClient()
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [search, setSearch] = useState('')

  // Fetch users
  const { data, isLoading, error } = useQuery({
    queryKey: ['users', search],
    queryFn: () => usersAPI.list({ search: search || undefined }),
  })

  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }) => usersAPI.update(id, { is_active: !isActive }),
    onSuccess: (_, { isActive }) => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success(isActive ? 'User deactivated' : 'User activated')
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to update user')
    },
  })

  const users = data?.users || data || []

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">User Management</h1>
          <p className="text-surface-500 mt-1">
            Manage user accounts and permissions
          </p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white font-medium rounded-xl hover:bg-primary-700 transition-colors"
        >
          <Plus size={18} />
          Add User
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search users..."
          className="w-full h-11 pl-10 pr-4 bg-white border border-surface-200 rounded-xl text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all"
        />
      </div>

      {/* Users List */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-surface-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-red-50 text-accent-red p-6 rounded-xl text-center">
          Failed to load users
        </div>
      ) : users.length === 0 ? (
        <div className="bg-white rounded-2xl border border-surface-200 p-12 text-center">
          <Users size={56} className="mx-auto text-surface-300 mb-4" />
          <h3 className="text-lg font-semibold text-surface-700 mb-2">
            {search ? 'No users found' : 'No users yet'}
          </h3>
          <p className="text-surface-500 mb-6">
            {search ? 'Try adjusting your search' : 'Create your first user to get started'}
          </p>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white font-medium rounded-xl hover:bg-primary-700 transition-colors"
          >
            <Plus size={18} />
            Add User
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {users.map((user) => (
            <UserRow
              key={user.id}
              user={user}
              onToggleActive={(id, isActive) => toggleActiveMutation.mutate({ id, isActive })}
            />
          ))}
        </div>
      )}

      {/* Create Modal */}
      <CreateUserModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  )
}

export default AdminUsers
