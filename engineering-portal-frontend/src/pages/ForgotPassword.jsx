import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { authAPI } from '../api/client'
import { toast } from 'react-hot-toast'
import { Mail, ArrowLeft, AlertCircle } from 'lucide-react'

export default function ForgotPassword() {
  const [resetToken, setResetToken] = useState(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm()

  const forgotPasswordMutation = useMutation({
    mutationFn: (email) => authAPI.forgotPassword(email),
    onSuccess: (data) => {
      toast.success('Reset instructions sent!')
      // For development, show the token
      if (data.token) {
        setResetToken(data.token)
      }
    },
    onError: () => {
      toast.error('Failed to send reset instructions')
    },
  })

  const onSubmit = (data) => {
    forgotPasswordMutation.mutate(data.email)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Back to Login */}
        <Link
          to="/login"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to login
        </Link>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
              <Mail className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Forgot Password?</h1>
            <p className="text-gray-600">
              Enter your email address and we'll send you instructions to reset your password.
            </p>
          </div>

          {!resetToken ? (
            /* Request Form */
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  {...register('email', {
                    required: 'Email is required',
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'Invalid email address',
                    },
                  })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="you@example.com"
                />
                {errors.email && (
                  <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {errors.email.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={forgotPasswordMutation.isPending}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {forgotPasswordMutation.isPending ? 'Sending...' : 'Send Reset Instructions'}
              </button>
            </form>
          ) : (
            /* Success Message with Token (Development Only) */
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-green-800 font-medium mb-2">Reset token generated!</p>
                <p className="text-sm text-green-700 mb-4">
                  In production, this would be sent to your email. For development, use this token:
                </p>
                <div className="bg-white border border-green-300 rounded p-3 mb-4">
                  <code className="text-xs text-gray-800 break-all">{resetToken}</code>
                </div>
                <Link
                  to={`/reset-password?token=${resetToken}`}
                  className="inline-block w-full text-center py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                >
                  Reset Password Now
                </Link>
              </div>

              <button
                onClick={() => setResetToken(null)}
                className="w-full text-gray-600 hover:text-gray-900 text-sm"
              >
                Send to a different email
              </button>
            </div>
          )}
        </div>

        {/* Help Text */}
        <p className="text-center text-sm text-gray-600 mt-6">
          Remember your password?{' '}
          <Link to="/login" className="text-blue-600 hover:text-blue-700 font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
