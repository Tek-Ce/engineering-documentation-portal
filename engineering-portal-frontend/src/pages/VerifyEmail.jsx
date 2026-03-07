import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { authAPI } from '../api/client'
import { Loader2, CheckCircle, XCircle, Mail } from 'lucide-react'

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [status, setStatus] = useState('loading') // loading | success | error | no-token
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('no-token')
      return
    }

    authAPI.verifyEmail(token)
      .then((data) => {
        setMessage(data.message || 'Email verified successfully!')
        setStatus('success')
      })
      .catch((err) => {
        setMessage(
          err.response?.data?.detail ||
          'This verification link is invalid or has expired.'
        )
        setStatus('error')
      })
  }, [token])

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-50 to-primary-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 text-center">

        {/* Loading */}
        {status === 'loading' && (
          <>
            <div className="w-16 h-16 rounded-full bg-primary-50 flex items-center justify-center mx-auto mb-6">
              <Loader2 size={32} className="animate-spin text-primary-500" />
            </div>
            <h1 className="text-xl font-bold text-surface-900 mb-2">Verifying your email…</h1>
            <p className="text-surface-500 text-sm">Please wait a moment.</p>
          </>
        )}

        {/* Success */}
        {status === 'success' && (
          <>
            <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-6">
              <CheckCircle size={36} className="text-green-500" />
            </div>
            <h1 className="text-xl font-bold text-surface-900 mb-2">Email Verified!</h1>
            <p className="text-surface-500 text-sm mb-8">{message}</p>
            <Link
              to="/login"
              className="inline-flex items-center justify-center w-full py-3 px-6 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 transition-colors"
            >
              Go to Login
            </Link>
          </>
        )}

        {/* Error */}
        {status === 'error' && (
          <>
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-6">
              <XCircle size={36} className="text-red-500" />
            </div>
            <h1 className="text-xl font-bold text-surface-900 mb-2">Verification Failed</h1>
            <p className="text-surface-500 text-sm mb-8">{message}</p>
            <p className="text-surface-400 text-xs mb-6">
              Ask your administrator to resend your invitation email, or use the link below.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center justify-center w-full py-3 px-6 bg-surface-100 text-surface-700 font-semibold rounded-xl hover:bg-surface-200 transition-colors"
            >
              Back to Login
            </Link>
          </>
        )}

        {/* No token */}
        {status === 'no-token' && (
          <>
            <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-6">
              <Mail size={36} className="text-amber-500" />
            </div>
            <h1 className="text-xl font-bold text-surface-900 mb-2">Check Your Email</h1>
            <p className="text-surface-500 text-sm mb-8">
              A verification link was sent to your email address when your account was created.
              Click the link in that email to activate your account.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center justify-center w-full py-3 px-6 bg-surface-100 text-surface-700 font-semibold rounded-xl hover:bg-surface-200 transition-colors"
            >
              Back to Login
            </Link>
          </>
        )}

        {/* Branding */}
        <p className="mt-8 text-xs text-surface-300">
          Engineering Documentation Portal
        </p>
      </div>
    </div>
  )
}
