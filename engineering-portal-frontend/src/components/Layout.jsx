import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  LayoutDashboard,
  FolderKanban,
  Bell,
  Settings,
  Users,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Hexagon,
  Database,
  Eye
} from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useAuthStore, useUIStore } from '../store/authStore'
import { notificationsAPI } from '../api/client'
import { OnlineUsersIndicator } from './OnlineUsersIndicator'
import clsx from 'clsx'

function Layout() {
  const navigate = useNavigate()
  const { user, logout, isAdmin } = useAuthStore()
  const { sidebarOpen, toggleSidebar } = useUIStore()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef(null)

  // Fetch notification count
  const { data: notifStats } = useQuery({
    queryKey: ['notification-stats'],
    queryFn: notificationsAPI.getStats,
    refetchInterval: 30000,
  })

  // Close menus when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    if (sidebarOpen && window.innerWidth < 1024) {
      document.body.style.overflow = 'hidden'
      document.body.style.touchAction = 'none'
    } else {
      document.body.style.overflow = ''
      document.body.style.touchAction = ''
    }
    return () => {
      document.body.style.overflow = ''
      document.body.style.touchAction = ''
    }
  }, [sidebarOpen])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/projects', icon: FolderKanban, label: 'Projects' },
    { to: '/reviews', icon: Eye, label: 'Review Queue' },
    { to: '/knowledge-base', icon: Database, label: 'Knowledge Base' },
    { to: '/notifications', icon: Bell, label: 'Notifications', badge: notifStats?.unread },
  ]

  const adminItems = [
    { to: '/admin/users', icon: Users, label: 'User Management' },
    { to: '/admin/settings', icon: Settings, label: 'Admin Settings' },
  ]

  return (
    <div className="min-h-screen bg-surface-50 flex">
      {/* Mobile Overlay - slides in with sidebar */}
      <div
        className={clsx(
          'fixed inset-0 z-30 lg:hidden transition-opacity duration-300 ease-out',
          sidebarOpen ? 'bg-surface-900/60 backdrop-blur-sm opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={toggleSidebar}
        aria-hidden="true"
      />

      {/* Sidebar - smooth slide on mobile */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 flex flex-col bg-surface-900 text-white',
          'transition-[transform,width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
          'lg:relative lg:transition-none',
          sidebarOpen
            ? 'w-64 translate-x-0 shadow-xl lg:shadow-none'
            : 'w-64 -translate-x-full lg:translate-x-0 lg:w-20'
        )}
        role="navigation"
        aria-label="Main navigation"
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-surface-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-lg">
              <Hexagon size={22} className="text-white" />
            </div>
            {sidebarOpen && (
              <div className="animate-fade-in">
                <h1 className="text-lg font-semibold tracking-tight">DocPortal</h1>
                <p className="text-xs text-surface-400">Engineering Docs</p>
              </div>
            )}
          </div>
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-lg hover:bg-surface-700/50 transition-colors"
          >
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => {
                // Close sidebar on mobile when clicking a nav item
                if (window.innerWidth < 1024) {
                  toggleSidebar()
                }
              }}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150',
                  isActive
                    ? 'bg-primary-600/20 text-primary-400'
                    : 'text-surface-300 hover:bg-surface-800 hover:text-white'
                )
              }
            >
              <item.icon size={20} className="flex-shrink-0" />
              {sidebarOpen && (
                <span className="font-medium text-sm animate-fade-in">{item.label}</span>
              )}
              {item.badge > 0 && (
                <span className={clsx(
                  'ml-auto bg-primary-500 text-white text-xs font-semibold rounded-full',
                  sidebarOpen ? 'px-2 py-0.5' : 'w-2 h-2'
                )}>
                  {sidebarOpen && item.badge}
                </span>
              )}
            </NavLink>
          ))}

          {/* Admin Section */}
          {isAdmin() && (
            <>
              {sidebarOpen && (
                <div className="pt-4 pb-2 animate-fade-in">
                  <p className="px-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">
                    Admin
                  </p>
                </div>
              )}
              {adminItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => {
                    if (window.innerWidth < 1024) toggleSidebar()
                  }}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150',
                      isActive
                        ? 'bg-primary-600/20 text-primary-400'
                        : 'text-surface-300 hover:bg-surface-800 hover:text-white'
                    )
                  }
                >
                  <item.icon size={20} className="flex-shrink-0" />
                  {sidebarOpen && (
                    <span className="font-medium text-sm animate-fade-in">{item.label}</span>
                  )}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        {/* User Section */}
        <div className="p-3 border-t border-surface-700/50">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150',
                isActive
                  ? 'bg-primary-600/20 text-primary-400'
                  : 'text-surface-300 hover:bg-surface-800 hover:text-white'
              )
            }
          >
            <Settings size={20} className="flex-shrink-0" />
            {sidebarOpen && (
              <span className="font-medium text-sm animate-fade-in">Settings</span>
            )}
          </NavLink>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col w-full lg:w-auto">
        {/* Top Bar */}
        <header className="h-16 bg-white border-b border-surface-200 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-20">
          {/* Mobile Menu Button */}
          <button
            onClick={toggleSidebar}
            className="lg:hidden p-2 rounded-lg hover:bg-surface-100 transition-colors"
          >
            {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>

          {/* App Title - Shows on mobile */}
          <div className="flex-1 lg:flex-none">
            <h1 className="text-base lg:text-lg font-semibold text-surface-900">DocPortal</h1>
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-2 lg:gap-4">
            {/* Online Users Indicator */}
            <div className="hidden sm:block">
              <OnlineUsersIndicator />
            </div>

            {/* Notifications */}
            <NavLink
              to="/notifications"
              className="relative p-2 rounded-lg hover:bg-surface-100 transition-colors"
            >
              <Bell size={18} className="text-surface-600 lg:w-5 lg:h-5" />
              {notifStats?.unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 lg:w-5 lg:h-5 bg-primary-500 text-white text-[10px] lg:text-xs font-semibold rounded-full flex items-center justify-center">
                  {notifStats.unread > 9 ? '9+' : notifStats.unread}
                </span>
              )}
            </NavLink>

            {/* User Menu */}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-1 lg:gap-2 px-2 lg:px-3 py-1.5 rounded-lg hover:bg-surface-100 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-semibold text-sm">
                  {user?.full_name?.charAt(0) || 'U'}
                </div>
                <div className="text-left hidden lg:block">
                  <p className="text-sm font-medium text-surface-800">{user?.full_name}</p>
                  <p className="text-xs text-surface-500">{user?.role}</p>
                </div>
                <ChevronDown
                  size={14}
                  className={clsx(
                    'text-surface-400 transition-transform duration-200 hidden lg:block',
                    userMenuOpen && 'rotate-180'
                  )}
                />
              </button>

              {/* Dropdown */}
              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-modal border border-surface-200 py-2 animate-slide-down">
                  <div className="px-4 py-2 border-b border-surface-100">
                    <p className="font-medium text-surface-800">{user?.full_name}</p>
                    <p className="text-sm text-surface-500">{user?.email}</p>
                  </div>
                  <div className="py-1">
                    <button
                      onClick={() => {
                        navigate('/settings')
                        setUserMenuOpen(false)
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-surface-600 hover:bg-surface-50 transition-colors"
                    >
                      <Settings size={16} />
                      Settings
                    </button>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-accent-red hover:bg-red-50 transition-colors"
                    >
                      <LogOut size={16} />
                      Log out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default Layout
