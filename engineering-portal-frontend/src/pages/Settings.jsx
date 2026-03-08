import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useMutation, useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  User,
  Lock,
  Mail,
  Shield,
  Eye,
  EyeOff,
  Loader2,
  Check,
  FolderKanban,
  ArrowRight,
  Bell
} from 'lucide-react'
import { authAPI, projectsAPI } from '../api/client'
import { useAuthStore } from '../store/authStore'
import clsx from 'clsx'

function ProfileEditor({ initialData, onSaved }) {
  const { updateUser } = useAuthStore()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ defaultValues: initialData })

  const mutation = useMutation({
    mutationFn: (data) => authAPI.updateProfile(data),
    onSuccess: (data) => {
      updateUser(data)
      toast.success('Profile updated')
      if (onSaved) onSaved(data)
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || 'Failed to update profile')
    },
  })

  const onSubmit = (data) => {
    mutation.mutate(data)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-md">
      <div>
        <label className="block text-sm font-medium text-surface-700 mb-1.5">Full Name</label>
        <input
          {...register('full_name', { required: 'Full name is required' })}
          className="w-full h-11 px-4 bg-surface-50 border border-surface-200 rounded-xl"
        />
        {errors.full_name && <p className="text-sm text-accent-red mt-1">{errors.full_name.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-surface-700 mb-1.5">Email</label>
        <input
          {...register('email', { required: 'Email is required' })}
          className="w-full h-11 px-4 bg-surface-50 border border-surface-200 rounded-xl"
        />
        {errors.email && <p className="text-sm text-accent-red mt-1">{errors.email.message}</p>}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={mutation.isPending}
          className="px-4 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50"
        >
          {mutation.isPending ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  )
}

function Settings() {
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState('profile')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)

  // Password change form
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      current_password: '',
      new_password: '',
      confirm_password: '',
    },
  })

  const newPassword = watch('new_password')

  const changePasswordMutation = useMutation({
    mutationFn: (data) => authAPI.changePassword(data.current_password, data.new_password),
    onSuccess: () => {
      toast.success('Password changed successfully!')
      reset()
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to change password')
    },
  })

  const onSubmitPassword = (data) => {
    changePasswordMutation.mutate(data)
  }

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'projects', label: 'My Projects', icon: FolderKanban },
    { id: 'security', label: 'Security', icon: Lock },
    { id: 'notifications', label: 'Notifications', icon: Bell },
  ]

  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsAPI.list(),
    enabled: activeTab === 'projects',
  })

  const roleLabels = {
    ADMIN: { label: 'Administrator', color: 'bg-amber-100 text-amber-700' },
    ENGINEER: { label: 'Engineer', color: 'bg-primary-100 text-primary-700' },
    VIEWER: { label: 'Viewer', color: 'bg-surface-100 text-surface-600' },
  }

  const role = roleLabels[user?.role] || roleLabels.VIEWER

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-surface-900">Settings</h1>
        <p className="text-surface-500 mt-1">
          Manage your account settings and preferences
        </p>
      </div>

      {/* Content */}
      <div className="bg-white rounded-2xl border border-surface-200 overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-surface-100">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors',
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600 bg-primary-50/50'
                  : 'border-transparent text-surface-500 hover:text-surface-700 hover:bg-surface-50'
              )}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'profile' && (
            <div className="space-y-6">
              {/* Profile Header */}
              <div className="flex items-center gap-4 p-4 bg-surface-50 rounded-xl">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-2xl font-bold">
                  {user?.full_name?.charAt(0) || 'U'}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-surface-900">{user?.full_name}</h3>
                  <p className="text-surface-500">{user?.email}</p>
                </div>
                <span className={clsx(
                  'px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-1.5',
                  role.color
                )}>
                  <Shield size={14} />
                  {role.label}
                </span>
              </div>

              {/* Profile Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-surface-500 mb-1.5">
                    Full Name
                  </label>
                  <div className="flex items-center gap-3 h-11 px-4 bg-surface-50 border border-surface-200 rounded-xl">
                    <User size={18} className="text-surface-400" />
                    <span className="text-surface-900">{user?.full_name}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-surface-500 mb-1.5">
                    Email Address
                  </label>
                  <div className="flex items-center gap-3 h-11 px-4 bg-surface-50 border border-surface-200 rounded-xl">
                    <Mail size={18} className="text-surface-400" />
                    <span className="text-surface-900">{user?.email}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-surface-500 mb-1.5">
                    Role
                  </label>
                  <div className="flex items-center gap-3 h-11 px-4 bg-surface-50 border border-surface-200 rounded-xl">
                    <Shield size={18} className="text-surface-400" />
                    <span className="text-surface-900">{user?.role}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-surface-500 mb-1.5">
                    Status
                  </label>
                  <div className="flex items-center gap-3 h-11 px-4 bg-surface-50 border border-surface-200 rounded-xl">
                    <div className={clsx(
                      'w-2.5 h-2.5 rounded-full',
                      user?.is_active ? 'bg-accent-green' : 'bg-surface-400'
                    )} />
                    <span className="text-surface-900">
                      {user?.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Account Info */}
              <div className="pt-4 border-t border-surface-100">
                <h4 className="text-sm font-medium text-surface-700 mb-3">Account Information</h4>
                <div className="text-sm text-surface-500 space-y-2">
                  <p>
                    <span className="text-surface-400">Last Login:</span>{' '}
                    {user?.last_login 
                      ? new Date(user.last_login).toLocaleString() 
                      : 'N/A'
                    }
                  </p>
                  <p>
                    <span className="text-surface-400">Account Created:</span>{' '}
                    {user?.created_at 
                      ? new Date(user.created_at).toLocaleDateString() 
                      : 'N/A'
                    }
                  </p>
                </div>
              </div>
              {/* Editable Profile */}
              <div className="pt-4 border-t border-surface-100">
                <h4 className="text-sm font-medium text-surface-700 mb-3">Edit Profile</h4>
                <ProfileToggle initialData={{ full_name: user?.full_name, email: user?.email }} />
              </div>
            </div>
          )}

          {activeTab === 'projects' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-surface-900">Projects you have access to</h3>
              <p className="text-sm text-surface-500">
                Quick links to projects where you are a member.
              </p>
              {projectsLoading ? (
                <div className="flex items-center gap-2 text-surface-500 py-6">
                  <Loader2 size={20} className="animate-spin" />
                  Loading projects…
                </div>
              ) : projects.length === 0 ? (
                <div className="py-8 text-center text-surface-500 rounded-xl bg-surface-50 border border-surface-100">
                  <FolderKanban size={40} className="mx-auto mb-2 text-surface-300" />
                  <p>You are not a member of any projects yet.</p>
                  <Link to="/projects" className="inline-block mt-3 text-primary-600 hover:underline font-medium">
                    Browse projects
                  </Link>
                </div>
              ) : (
                <ul className="space-y-2">
                  {projects.map((project) => (
                    <li key={project.id}>
                      <Link
                        to={`/projects/${project.id}`}
                        className="flex items-center justify-between p-3 sm:p-4 rounded-xl border border-surface-200 hover:border-primary-200 hover:bg-primary-50/50 transition-colors group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
                            <FolderKanban size={20} className="text-primary-600" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-surface-900 truncate">{project.name}</p>
                            {project.code && (
                              <p className="text-xs text-surface-500">{project.code}</p>
                            )}
                          </div>
                        </div>
                        <ArrowRight size={18} className="text-surface-400 group-hover:text-primary-600 flex-shrink-0 ml-2" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <Link
                to="/projects"
                className="inline-flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700 mt-2"
              >
                <FolderKanban size={16} />
                View all projects
              </Link>
            </div>
          )}

          {activeTab === 'notifications' && (
            <NotificationPrefsPanel />
          )}

          {activeTab === 'security' && (
            <div className="max-w-md">
              <h3 className="text-lg font-semibold text-surface-900 mb-1">Change Password</h3>
              <p className="text-sm text-surface-500 mb-6">
                Update your password to keep your account secure
              </p>

              <form onSubmit={handleSubmit(onSubmitPassword)} className="space-y-5">
                {/* Current Password */}
                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1.5">
                    Current Password
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      {...register('current_password', { required: 'Current password is required' })}
                      className="w-full h-11 px-4 pr-12 bg-surface-50 border border-surface-200 rounded-xl text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all"
                      placeholder="Enter current password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 transition-colors"
                    >
                      {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {errors.current_password && (
                    <p className="mt-1.5 text-sm text-accent-red">{errors.current_password.message}</p>
                  )}
                </div>

                {/* New Password */}
                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1.5">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      {...register('new_password', { 
                        required: 'New password is required',
                        minLength: { value: 8, message: 'Password must be at least 8 characters' }
                      })}
                      className="w-full h-11 px-4 pr-12 bg-surface-50 border border-surface-200 rounded-xl text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all"
                      placeholder="Enter new password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 transition-colors"
                    >
                      {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {errors.new_password && (
                    <p className="mt-1.5 text-sm text-accent-red">{errors.new_password.message}</p>
                  )}
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1.5">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    {...register('confirm_password', { 
                      required: 'Please confirm your password',
                      validate: value => value === newPassword || 'Passwords do not match'
                    })}
                    className="w-full h-11 px-4 bg-surface-50 border border-surface-200 rounded-xl text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all"
                    placeholder="Confirm new password"
                  />
                  {errors.confirm_password && (
                    <p className="mt-1.5 text-sm text-accent-red">{errors.confirm_password.message}</p>
                  )}
                </div>

                {/* Password Requirements */}
                <div className="p-4 bg-surface-50 rounded-xl">
                  <p className="text-sm font-medium text-surface-700 mb-2">Password Requirements</p>
                  <ul className="space-y-1.5 text-sm text-surface-500">
                    <li className="flex items-center gap-2">
                      <Check size={14} className="text-accent-green" />
                      At least 8 characters
                    </li>
                    <li className="flex items-center gap-2">
                      <Check size={14} className="text-surface-300" />
                      Mix of letters and numbers (recommended)
                    </li>
                    <li className="flex items-center gap-2">
                      <Check size={14} className="text-surface-300" />
                      Special characters (recommended)
                    </li>
                  </ul>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={changePasswordMutation.isPending}
                  className="w-full h-11 bg-primary-600 text-white font-medium rounded-xl hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {changePasswordMutation.isPending ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Lock size={18} />
                      Update Password
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function NotificationPrefsPanel() {
  const { user } = useAuthStore()
  const { data: prefs, isLoading } = useQuery({
    queryKey: ['notification-prefs'],
    queryFn: () => authAPI.getNotificationPrefs(),
  })

  const mutation = useMutation({
    mutationFn: (updates) => authAPI.updateNotificationPrefs(updates),
    onSuccess: () => toast.success('Notification preferences saved'),
    onError: () => toast.error('Failed to save preferences'),
  })

  const toggle = (key, currentValue) => {
    mutation.mutate({ [key]: !currentValue })
  }

  const options = [
    {
      key: 'notify_login_alert',
      label: 'Login alerts',
      description: 'Get an email every time someone logs into your account from a new session.',
    },
    {
      key: 'notify_security_events',
      label: 'Security events',
      description: 'Get an email when your password is changed or your account settings are modified.',
    },
    {
      key: 'notify_document_activity',
      label: 'Document activity',
      description: 'Get an email when your documents are approved, rejected, or sent for review.',
    },
  ]

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-surface-500 py-8">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm">Loading preferences...</span>
      </div>
    )
  }

  return (
    <div className="max-w-md">
      <h3 className="text-lg font-semibold text-surface-900 mb-1">Email Notifications</h3>
      <p className="text-sm text-surface-500 mb-6">
        Choose which events trigger an email notification to your inbox.
      </p>

      <div className="space-y-4">
        {options.map(({ key, label, description }) => {
          const enabled = prefs ? prefs[key] : false
          return (
            <div key={key} className="flex items-start justify-between gap-4 p-4 bg-surface-50 rounded-xl border border-surface-100">
              <div className="flex-1">
                <p className="text-sm font-medium text-surface-900">{label}</p>
                <p className="text-sm text-surface-500 mt-0.5">{description}</p>
              </div>
              <button
                onClick={() => toggle(key, enabled)}
                disabled={mutation.isPending}
                className={clsx(
                  'relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50',
                  enabled ? 'bg-primary-600' : 'bg-surface-300'
                )}
                role="switch"
                aria-checked={enabled}
              >
                <span
                  className={clsx(
                    'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200',
                    enabled ? 'translate-x-5' : 'translate-x-0'
                  )}
                />
              </button>
            </div>
          )
        })}
      </div>

      <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-xl">
        <p className="text-sm text-blue-700">
          <strong>Note:</strong> Emails are sent to <strong>{user?.email}</strong>.
          To receive emails, your domain must be verified with our mail provider.
        </p>
      </div>
    </div>
  )
}

function ProfileToggle({ initialData }) {
  const [isEditing, setIsEditing] = useState(false)

  return (
    <div>
      {!isEditing ? (
        <div className="flex items-center gap-3">
          <p className="text-sm text-surface-500 mr-4">Want to update your name or email? Click Edit.</p>
          <button onClick={() => setIsEditing(true)} className="px-3 py-2 rounded-xl bg-primary-600 text-white hover:bg-primary-700 text-sm">
            Edit Profile
          </button>
        </div>
      ) : (
        <div>
          <ProfileEditor initialData={initialData} onSaved={() => setIsEditing(false)} />
          <div className="mt-3">
            <button onClick={() => setIsEditing(false)} className="px-3 py-2 rounded-xl border border-surface-200 text-sm">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default Settings
