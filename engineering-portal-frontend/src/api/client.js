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
}

export default api
