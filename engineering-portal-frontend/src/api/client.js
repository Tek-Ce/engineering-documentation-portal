import axios from 'axios'
import { useAuthStore } from '../store/authStore'

const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor - add auth token
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor - handle 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// Auth API
export const authAPI = {
  login: async (email, password) => {
    const formData = new URLSearchParams()
    formData.append('username', email)
    formData.append('password', password)
    
    const response = await api.post('/auth/login', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    return response.data
  },
  
  getMe: async () => {
    const response = await api.get('/auth/me')
    return response.data
  },

  updateProfile: async (data) => {
    const response = await api.patch('/users/me', data)
    return response.data
  },
  
  changePassword: async (currentPassword, newPassword) => {
    const response = await api.post('/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    })
    return response.data
  },

  forgotPassword: async (email) => {
    const response = await api.post('/auth/forgot-password', { email })
    return response.data
  },

  resetPassword: async (token, newPassword) => {
    const response = await api.post('/auth/reset-password', {
      token,
      new_password: newPassword,
    })
    return response.data
  },

  verifyEmail: async (token) => {
    const response = await api.get('/auth/verify-email', { params: { token } })
    return response.data
  },

  resendVerification: async (email) => {
    const response = await api.post('/auth/resend-verification', { email })
    return response.data
  },
}

// Projects API
export const projectsAPI = {
  list: async (params = {}) => {
    const response = await api.get('/projects', { params })
    return response.data
  },
  
  get: async (id) => {
    const response = await api.get(`/projects/${id}`)
    return response.data
  },
  
  create: async (data) => {
    const response = await api.post('/projects', data)
    return response.data
  },
  
  update: async (id, data) => {
    const response = await api.put(`/projects/${id}`, data)
    return response.data
  },
  
  delete: async (id) => {
    await api.delete(`/projects/${id}`)
  },
  
  archive: async (id) => {
    const response = await api.post(`/projects/${id}/archive`)
    return response.data
  },

  restore: async (id) => {
    const response = await api.post(`/projects/${id}/restore`)
    return response.data
  },

  complete: async (id) => {
    const response = await api.post(`/projects/${id}/complete`)
    return response.data
  },

  getStats: async (id) => {
    const response = await api.get(`/projects/${id}/stats`)
    return response.data
  },
  
  getMembers: async (id) => {
    const response = await api.get(`/projects/${id}/members`)
    return response.data
  },
  
  addMember: async (projectId, data) => {
    const response = await api.post(`/projects/${projectId}/members`, data)
    return response.data
  },
  
  updateMemberRole: async (projectId, userId, role) => {
    const response = await api.put(`/projects/${projectId}/members/${userId}/role`, null, {
      params: { role },
    })
    return response.data
  },
  
  removeMember: async (projectId, userId) => {
    await api.delete(`/projects/${projectId}/members/${userId}`)
  },
}

// Documents API
export const documentsAPI = {
  upload: async (projectId, title, description, status, file, documentType = 'other', tags = [], reviewerIds = []) => {
    const formData = new FormData()
    formData.append('project_id', projectId)
    formData.append('title', title)
    formData.append('description', description || '')
    formData.append('status_value', status)
    formData.append('document_type_value', documentType)
    formData.append('file', file)

    // Add tags as comma-separated string
    if (tags && tags.length > 0) {
      formData.append('tags', tags.join(','))
    }

    // Add reviewer IDs as comma-separated string
    if (reviewerIds && reviewerIds.length > 0) {
      formData.append('reviewer_ids', reviewerIds.join(','))
    }

    const response = await api.post('/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },

  recentlyViewed: async (limit = 10) => {
    const response = await api.get('/documents/recently-viewed', { params: { limit } })
    return response.data
  },

  pendingReview: async () => {
    const response = await api.get('/documents/pending-review')
    return response.data
  },

  submitForReview: async (documentId) => {
    const response = await api.post(`/documents/${documentId}/submit-review`)
    return response.data
  },

  approve: async (documentId) => {
    const response = await api.post(`/documents/${documentId}/approve`)
    return response.data
  },

  reject: async (documentId, reason = '') => {
    const response = await api.post(`/documents/${documentId}/reject`, null, {
      params: reason ? { reason } : {}
    })
    return response.data
  },

  listByProject: async (projectId, params = {}) => {
    const response = await api.get(`/documents/project/${projectId}`, { params })
    return response.data
  },

  get: async (id) => {
    const response = await api.get(`/documents/${id}`)
    return response.data
  },

  delete: async (id) => {
    await api.delete(`/documents/${id}`)
  },

  uploadNewVersion: async (documentId, file, changeNotes = '') => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('change_notes', changeNotes)

    const response = await api.post(`/documents/${documentId}/upload-new-version`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },

  getVersions: async (documentId) => {
    const response = await api.get(`/documents/${documentId}/versions`)
    return response.data
  },

  getActivity: async (documentId, limit = 50) => {
    const response = await api.get(`/documents/${documentId}/activity`, { params: { limit } })
    return response.data
  },

  download: (documentId, version = null) => {
    const token = useAuthStore.getState().token
    const versionParam = version ? `version=${version}&` : ''
    const tokenParam = token ? `token=${token}` : ''
    const params = versionParam || tokenParam ? `?${versionParam}${tokenParam}` : ''
    return `/api/v1/documents/${documentId}/download${params}`
  },

  update: async (documentId, data) => {
    const response = await api.patch(`/documents/${documentId}`, data)
    return response.data
  },

  delete: async (documentId) => {
    await api.delete(`/documents/${documentId}`)
  },
}

// Comments API
export const commentsAPI = {
  getDocumentComments: async (documentId) => {
    const response = await api.get(`/comments/document/${documentId}`)
    return response.data
  },
  
  getThreads: async (documentId, resolved = null) => {
    const params = resolved !== null ? { resolved } : {}
    const response = await api.get(`/comments/document/${documentId}/threads`, { params })
    return response.data
  },
  
  create: async (data) => {
    const response = await api.post('/comments', data)
    return response.data
  },
  
  update: async (id, data) => {
    const response = await api.put(`/comments/${id}`, data)
    return response.data
  },
  
  delete: async (id) => {
    await api.delete(`/comments/${id}`)
  },
  
  resolve: async (id) => {
    const response = await api.post(`/comments/${id}/resolve`)
    return response.data
  },
  
  unresolve: async (id) => {
    const response = await api.post(`/comments/${id}/unresolve`)
    return response.data
  },
}

// Notifications API
export const notificationsAPI = {
  list: async (params = {}) => {
    const response = await api.get('/notifications', { params })
    return response.data
  },
  
  getUnread: async () => {
    const response = await api.get('/notifications/unread')
    return response.data
  },
  
  getStats: async () => {
    const response = await api.get('/notifications/stats')
    return response.data
  },
  
  markRead: async (id) => {
    const response = await api.post(`/notifications/${id}/read`)
    return response.data
  },
  
  markAllRead: async () => {
    const response = await api.post('/notifications/read-all')
    return response.data
  },
  
  delete: async (id) => {
    await api.delete(`/notifications/${id}`)
  },
}

// Tags API
export const tagsAPI = {
  list: async () => {
    const response = await api.get('/tags')
    return response.data
  },

  create: async (data) => {
    const response = await api.post('/tags', data)
    return response.data
  },

  delete: async (id) => {
    await api.delete(`/tags/${id}`)
  },

  getDocumentTags: async (documentId) => {
    const response = await api.get(`/tags/document/${documentId}`)
    return response.data
  },

  addToDocument: async (documentId, tagId) => {
    const response = await api.post(`/tags/document/${documentId}/tag/${tagId}`)
    return response.data
  },

  removeFromDocument: async (documentId, tagId) => {
    await api.delete(`/tags/document/${documentId}/tag/${tagId}`)
  },

  bulkAddToDocument: async (documentId, tagIds) => {
    const response = await api.post(`/tags/document/${documentId}/tags/bulk`, tagIds)
    return response.data
  },
}

// Project Comments API
export const projectCommentsAPI = {
  list: async (projectId, params = {}) => {
    const response = await api.get('/project-comments', {
      params: { project_id: projectId, ...params }
    })
    return response.data
  },

  create: async (data) => {
    const response = await api.post('/project-comments', data)
    return response.data
  },

  get: async (id) => {
    const response = await api.get(`/project-comments/${id}`)
    return response.data
  },

  update: async (id, data) => {
    const response = await api.patch(`/project-comments/${id}`, data)
    return response.data
  },

  delete: async (id) => {
    await api.delete(`/project-comments/${id}`)
  },
}

// Users API (Admin)
export const usersAPI = {
  list: async (params = {}) => {
    const response = await api.get('/users', { params })
    return response.data
  },
  
  get: async (id) => {
    const response = await api.get(`/users/${id}`)
    return response.data
  },
  
  create: async (data) => {
    const response = await api.post('/users', data)
    return response.data
  },
  
  update: async (id, data) => {
    const response = await api.put(`/users/${id}`, data)
    return response.data
  },
  
  deactivate: async (id) => {
    const response = await api.put(`/users/${id}`, { is_active: false })
    return response.data
  },
}

// Search API
export const searchAPI = {
  search: async (query, limit = 10) => {
    const response = await api.get('/search', {
      params: { q: query, limit }
    })
    return response.data
  },
}

// Admin API
export const adminAPI = {
  resetDatabase: async () => {
    const response = await api.post('/admin/reset-database')
    return response.data
  },

  // Activity Logs
  getActivityLogs: async (params = {}) => {
    const response = await api.get('/admin/activity-logs', { params })
    return response.data
  },

  getActivityStats: async (days = 30) => {
    const response = await api.get('/admin/activity-stats', { params: { days } })
    return response.data
  },

  // User Presence
  getOnlineUsers: async (thresholdMinutes = 5) => {
    const response = await api.get('/admin/online-users', {
      params: { threshold_minutes: thresholdMinutes }
    })
    return response.data
  },

  getUsersWithStatus: async (params = {}) => {
    const response = await api.get('/admin/users-status', { params })
    return response.data
  },

  // Heartbeat - call this periodically to update user's online status
  heartbeat: async () => {
    const response = await api.post('/admin/heartbeat')
    return response.data
  },
}

// Knowledge Base API
export const kbAPI = {
  // Search
  search: async (query, options = {}) => {
    const params = {
      q: query,
      limit: options.limit || 20,
      offset: options.offset || 0,
      use_semantic: options.useSemantic !== false,
      use_keyword: options.useKeyword !== false,
    }
    if (options.projectId) params.project_id = options.projectId

    const response = await api.get('/kb/search', { params })
    return response.data
  },

  searchAdvanced: async (request) => {
    const response = await api.post('/kb/search', request)
    return response.data
  },

  // Indexing
  indexDocument: async (documentId) => {
    const response = await api.post(`/kb/index/document/${documentId}`)
    return response.data
  },

  indexProject: async (projectId, forceReindex = false) => {
    const response = await api.post(`/kb/index/project/${projectId}`, null, {
      params: { force_reindex: forceReindex }
    })
    return response.data
  },

  deleteDocumentIndex: async (documentId) => {
    const response = await api.delete(`/kb/index/document/${documentId}`)
    return response.data
  },

  // Status
  getDocumentStatus: async (documentId) => {
    const response = await api.get(`/kb/status/document/${documentId}`)
    return response.data
  },

  getProjectStatus: async (projectId) => {
    const response = await api.get(`/kb/status/project/${projectId}`)
    return response.data
  },

  getStats: async () => {
    const response = await api.get('/kb/stats')
    return response.data
  },

  // Jobs
  listJobs: async (params = {}) => {
    const response = await api.get('/kb/jobs', { params })
    return response.data
  },

  getJob: async (jobId) => {
    const response = await api.get(`/kb/jobs/${jobId}`)
    return response.data
  },

  cancelJob: async (jobId) => {
    const response = await api.post(`/kb/jobs/${jobId}/cancel`)
    return response.data
  },

  // Settings
  getSettings: async (projectId) => {
    const response = await api.get(`/kb/settings/${projectId}`)
    return response.data
  },

  updateSettings: async (projectId, settings) => {
    const response = await api.put(`/kb/settings/${projectId}`, settings)
    return response.data
  },

  // Admin - Crawler
  triggerCrawlerScan: async () => {
    const response = await api.post('/kb/crawler/scan')
    return response.data
  },

  processPendingJobs: async (maxJobs = 10) => {
    const response = await api.post('/kb/crawler/process', null, {
      params: { max_jobs: maxJobs }
    })
    return response.data
  },

  // Index all documents synchronously (admin only)
  indexAllDocuments: async (forceReindex = false) => {
    const response = await api.post('/kb/index-all', null, {
      params: { force_reindex: forceReindex }
    })
    return response.data
  },

  // AI Chat - ask questions about document content
  chat: async ({
    message,
    documentId = null,
    documentTitle = null,
    projectName = null,
    chunkText = null,
    fileName = null,
    searchQuery = null,
    history = null
  }) => {
    const response = await api.post('/kb/chat', {
      message,
      document_id: documentId,
      document_title: documentTitle,
      project_name: projectName,
      chunk_text: chunkText,
      file_name: fileName,
      search_query: searchQuery,
      history: history?.map(msg => ({
        role: msg.role,
        content: msg.content
      }))
    })
    return response.data
  },
}

export default api
