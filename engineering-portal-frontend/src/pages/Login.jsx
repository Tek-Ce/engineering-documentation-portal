import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Hexagon, Loader2, ArrowRight, MailWarning } from 'lucide-react'
import { authAPI } from '../api/client'
import { useAuthStore } from '../store/authStore'

function Login() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [showPassword, setShowPassword] = useState(false)
  const [unverifiedEmail, setUnverifiedEmail] = useState(null)
  const [resendSent, setResendSent] = useState(false)

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm({
    defaultValues: {
      email: '',
      password: '',
    },
  })

  const resendMutation = useMutation({
    mutationFn: (email) => authAPI.resendVerification(email),
    onSuccess: () => {
      setResendSent(true)
      toast.success('Verification email sent — check your inbox.')
    },
    onError: () => {
      toast.error('Could not send verification email. Try again later.')
    },
  })

  const loginMutation = useMutation({
    mutationFn: (data) => authAPI.login(data.email, data.password),
    onSuccess: (data) => {
      setAuth(data.user, data.access_token)
      toast.success(`Welcome back, ${data.user.full_name}!`)
      navigate('/')
    },
    onError: (error) => {
      const detail = error.response?.data?.detail
      if (detail === 'EMAIL_NOT_VERIFIED') {
        setUnverifiedEmail(getValues('email'))
        setResendSent(false)
      } else if (detail === 'NO_ACCOUNT') {
        toast.error('No account found with this email address.')
      } else if (detail === 'WRONG_PASSWORD') {
        toast.error('Incorrect password. Please try again.')
      } else if (detail === 'ACCOUNT_INACTIVE') {
        toast.error('Your account has been deactivated. Contact your administrator.')
      } else {
        toast.error(detail || 'Login failed. Please try again.')
      }
    },
  })

  const onSubmit = (data) => {
    loginMutation.mutate(data)
  }

  return (
    <div className="min-h-screen bg-surface-900 flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 bg-gradient-to-br from-surface-900 via-surface-800 to-primary-900/30 relative overflow-hidden">
        {/* Grid Pattern */}
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        
        {/* Decorative Elements */}
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-primary-600/10 rounded-full blur-3xl" />
        
        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-16 xl:px-24">
          <div className="mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-2xl mb-6">
              <Hexagon size={32} className="text-white" />
            </div>
            <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-4">
              Engineering<br />
              Documentation<br />
              <span className="text-primary-400">Portal</span>
            </h1>
            <p className="text-surface-400 text-lg max-w-md">
              Centralized platform for managing, collaborating, and versioning your engineering documentation.
            </p>
          </div>

          {/* Features */}
          <div className="space-y-4 mt-8">
            {[
              'Project-centric document organization',
              'Real-time collaboration & comments',
              'Version control & change tracking',
              'Role-based access management',
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-3 text-surface-300">
                <div className="w-1.5 h-1.5 rounded-full bg-primary-500" />
                <span className="text-sm">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden mb-8 text-center">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-lg mx-auto mb-4">
              <Hexagon size={28} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-surface-900">DocPortal</h1>
            <p className="text-surface-500 text-sm">Engineering Documentation Portal</p>
          </div>

          {/* Form Header */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-surface-900 mb-2">Welcome back</h2>
            <p className="text-surface-500">Sign in to your account to continue</p>
          </div>

          {/* Email Not Verified Banner */}
          {unverifiedEmail && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="flex gap-3">
                <MailWarning size={20} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-amber-800">Email not verified</p>
                  <p className="text-sm text-amber-700 mt-0.5">
                    Please verify <span className="font-mono font-semibold">{unverifiedEmail}</span> before signing in.
                  </p>
                  {resendSent ? (
                    <p className="text-sm text-amber-600 mt-2 font-medium">Email sent — check your inbox.</p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => resendMutation.mutate(unverifiedEmail)}
                      disabled={resendMutation.isPending}
                      className="mt-2 text-sm font-medium text-amber-800 underline hover:text-amber-900 disabled:opacity-50"
                    >
                      {resendMutation.isPending ? 'Sending...' : 'Resend verification email'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1.5">
                Email address
              </label>
              <input
                type="email"
                {...register('email', {
                  required: 'Email is required',
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: 'Invalid email address',
                  },
                })}
                className="w-full h-12 px-4 bg-surface-50 border border-surface-200 rounded-xl text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all"
                placeholder="name@company.com"
              />
              {errors.email && (
                <p className="mt-1.5 text-sm text-accent-red">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  {...register('password', {
                    required: 'Password is required',
                    minLength: {
                      value: 6,
                      message: 'Password must be at least 6 characters',
                    },
                  })}
                  className="w-full h-12 px-4 pr-12 bg-surface-50 border border-surface-200 rounded-xl text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1.5 text-sm text-accent-red">{errors.password.message}</p>
              )}
            </div>

            {/* Forgot Password */}
            <div className="flex justify-end">
              <Link
                to="/forgot-password"
                className="text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors"
              >
                Forgot password?
              </Link>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full h-12 bg-gradient-to-r from-primary-600 to-primary-700 text-white font-semibold rounded-xl hover:from-primary-700 hover:to-primary-800 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 group"
            >
              {loginMutation.isPending ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Demo Credentials */}
          <div className="mt-8 p-4 bg-surface-50 rounded-xl border border-surface-200">
            <p className="text-sm font-medium text-surface-700 mb-2">Demo Credentials</p>
            <div className="text-sm text-surface-500 font-mono space-y-1">
              <p>xxxx.yyy@outlook.com / 123,..</p>
           </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login
