import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  User,
  Lock,
  Mail,
  Shield,
  Eye,
  EyeOff,
  Loader2,
  Check
} from 'lucide-react'
import { authAPI } from '../api/client'
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
    { id: 'security', label: 'Security', icon: Lock },
  ]

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
