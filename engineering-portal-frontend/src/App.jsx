import { Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { useAuthStore } from './store/authStore'
import { useHeartbeat } from './hooks/useHeartbeat'
import Layout from './components/Layout'
import { Loader2 } from 'lucide-react'

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
  const { isAuthenticated } = useAuthStore()

  // Send heartbeat every 30 seconds to update online status
  useHeartbeat(30000)

  return (
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
  )
}

export default App
