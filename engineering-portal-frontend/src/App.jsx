import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { lazy, Suspense, useEffect, useState, Component } from 'react'
import { useAuthStore } from './store/authStore'
import { useHeartbeat } from './hooks/useHeartbeat'
import { authAPI } from './api/client'
import Layout from './components/Layout'
import { Loader2 } from 'lucide-react'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <h2 style={{ marginBottom: '1rem', color: '#dc2626' }}>Something went wrong</h2>
          <p style={{ marginBottom: '1rem', color: '#666' }}>{this.state.error?.message}</p>
          <button onClick={() => { this.setState({ hasError: false }); window.location.href = '/' }} style={{ padding: '0.5rem 1rem', background: '#4c6ef5', color: '#fff', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}>
            Go to Dashboard
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// Lazy load pages for code splitting
const Login = lazy(() => import('./pages/Login'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Projects = lazy(() => import('./pages/Projects'))
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'))
const DocumentDetail = lazy(() => import('./pages/DocumentDetail'))
const Notifications = lazy(() => import('./pages/Notifications'))
const AdminUsers = lazy(() => import('./pages/AdminUsers'))
const AdminSettings = lazy(() => import('./pages/AdminSettings'))
const Settings = lazy(() => import('./pages/Settings'))
const KnowledgeBase = lazy(() => import('./pages/KnowledgeBase'))
const ReviewQueue = lazy(() => import('./pages/ReviewQueue'))
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'))

// Loading fallback component
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 size={32} className="animate-spin text-primary-500" />
    </div>
  )
}

// Protected Route wrapper
function ProtectedRoute({ children, requireAdmin = false }) {
  const { isAuthenticated, user } = useAuthStore()
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  
  if (requireAdmin && user?.role !== 'ADMIN') {
    return <Navigate to="/" replace />
  }
  
  return children
}

function App() {
  const { isAuthenticated, logout } = useAuthStore()
  const [tokenChecked, setTokenChecked] = useState(false)

  // On startup: if we have a persisted token, verify it's still valid.
  // If not (expired, server rebooted with different key, etc.) log out cleanly.
  useEffect(() => {
    if (isAuthenticated) {
      authAPI.getMe()
        .catch(() => {
          logout()
          window.location.href = '/login?reason=session_expired'
        })
        .finally(() => setTokenChecked(true))
    } else {
      setTokenChecked(true)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Send heartbeat every 30 seconds to update online status
  useHeartbeat(30000)

  // Hold rendering until we've confirmed the token is valid (prevents flash of protected content)
  if (!tokenChecked) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-900">
        <Loader2 size={32} className="animate-spin text-primary-500" />
      </div>
    )
  }

  return (
    <ErrorBoundary>
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public Routes */}
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/" replace /> : <Login />}
        />
        <Route
          path="/forgot-password"
          element={isAuthenticated ? <Navigate to="/" replace /> : <ForgotPassword />}
        />
        <Route
          path="/reset-password"
          element={isAuthenticated ? <Navigate to="/" replace /> : <ResetPassword />}
        />
        <Route path="/verify-email" element={<VerifyEmail />} />

        {/* Protected Routes with Layout */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/:id" element={<ProjectDetail />} />
          <Route path="documents/:id" element={<DocumentDetail />} />
          <Route path="reviews" element={<ReviewQueue />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="knowledge-base" element={<KnowledgeBase />} />
          <Route path="settings" element={<Settings />} />

          {/* Admin Routes */}
          <Route
            path="admin/users"
            element={
              <ProtectedRoute requireAdmin>
                <AdminUsers />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/settings"
            element={
              <ProtectedRoute requireAdmin>
                <AdminSettings />
              </ProtectedRoute>
            }
          />
        </Route>

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
    </ErrorBoundary>
  )
}

export default App
