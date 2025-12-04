// Document statuses
export const DOCUMENT_STATUS = {
  DRAFT: 'draft',
  REVIEW: 'review',
  PUBLISHED: 'published',
}

export const DOCUMENT_STATUS_LABELS = {
  [DOCUMENT_STATUS.DRAFT]: 'Draft',
  [DOCUMENT_STATUS.REVIEW]: 'In Review',
  [DOCUMENT_STATUS.PUBLISHED]: 'Published',
}

export const DOCUMENT_STATUS_COLORS = {
  [DOCUMENT_STATUS.DRAFT]: {
    bg: 'bg-surface-100',
    text: 'text-surface-600',
    dot: 'bg-surface-400',
  },
  [DOCUMENT_STATUS.REVIEW]: {
    bg: 'bg-amber-100',
    text: 'text-accent-amber',
    dot: 'bg-accent-amber',
  },
  [DOCUMENT_STATUS.PUBLISHED]: {
    bg: 'bg-green-100',
    text: 'text-accent-green',
    dot: 'bg-accent-green',
  },
}

// Project statuses
export const PROJECT_STATUS = {
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  ARCHIVED: 'ARCHIVED',
}

export const PROJECT_STATUS_COLORS = {
  [PROJECT_STATUS.ACTIVE]: {
    bg: 'bg-green-100',
    text: 'text-accent-green',
    dot: 'bg-accent-green',
  },
  [PROJECT_STATUS.COMPLETED]: {
    bg: 'bg-primary-100',
    text: 'text-primary-600',
    dot: 'bg-primary-500',
  },
  [PROJECT_STATUS.ARCHIVED]: {
    bg: 'bg-surface-200',
    text: 'text-surface-500',
    dot: 'bg-surface-400',
  },
}

// User roles
export const USER_ROLE = {
  ADMIN: 'ADMIN',
  ENGINEER: 'ENGINEER',
  VIEWER: 'VIEWER',
}

export const USER_ROLE_LABELS = {
  [USER_ROLE.ADMIN]: 'Administrator',
  [USER_ROLE.ENGINEER]: 'Engineer',
  [USER_ROLE.VIEWER]: 'Viewer',
}

export const USER_ROLE_COLORS = {
  [USER_ROLE.ADMIN]: 'bg-amber-100 text-amber-700',
  [USER_ROLE.ENGINEER]: 'bg-primary-100 text-primary-700',
  [USER_ROLE.VIEWER]: 'bg-surface-100 text-surface-600',
}

// Project member roles
export const PROJECT_ROLE = {
  OWNER: 'OWNER',
  EDITOR: 'EDITOR',
  VIEWER: 'VIEWER',
}

export const PROJECT_ROLE_LABELS = {
  [PROJECT_ROLE.OWNER]: 'Owner',
  [PROJECT_ROLE.EDITOR]: 'Editor',
  [PROJECT_ROLE.VIEWER]: 'Viewer',
}

export const PROJECT_ROLE_COLORS = {
  [PROJECT_ROLE.OWNER]: 'bg-amber-100 text-amber-700',
  [PROJECT_ROLE.EDITOR]: 'bg-primary-100 text-primary-700',
  [PROJECT_ROLE.VIEWER]: 'bg-surface-100 text-surface-600',
}

// Notification types
export const NOTIFICATION_TYPE = {
  DOCUMENT_UPLOAD: 'DOCUMENT_UPLOAD',
  COMMENT: 'COMMENT',
  MENTION: 'MENTION',
  PROJECT: 'PROJECT',
}

// Accepted file types
export const ACCEPTED_FILE_TYPES = {
  documents: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.rtf',
  images: '.jpg,.jpeg,.png,.gif,.webp,.svg',
  all: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.rtf,.jpg,.jpeg,.png,.gif,.webp,.svg',
}

// File size limits (in bytes)
export const FILE_SIZE_LIMITS = {
  document: 50 * 1024 * 1024, // 50MB
  image: 10 * 1024 * 1024, // 10MB
}

// Pagination defaults
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 10,
  PAGE_SIZE_OPTIONS: [10, 25, 50, 100],
}

// API endpoints (for reference)
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    ME: '/auth/me',
    CHANGE_PASSWORD: '/auth/change-password',
  },
  PROJECTS: {
    LIST: '/projects',
    CREATE: '/projects',
    GET: (id) => `/projects/${id}`,
    UPDATE: (id) => `/projects/${id}`,
    DELETE: (id) => `/projects/${id}`,
    ARCHIVE: (id) => `/projects/${id}/archive`,
    STATS: (id) => `/projects/${id}/stats`,
    MEMBERS: (id) => `/projects/${id}/members`,
  },
  DOCUMENTS: {
    UPLOAD: '/documents/upload',
    GET: (id) => `/documents/${id}`,
    UPDATE: (id) => `/documents/${id}`,
    DELETE: (id) => `/documents/${id}`,
  },
  COMMENTS: {
    LIST: (docId) => `/comments/document/${docId}`,
    THREADS: (docId) => `/comments/document/${docId}/threads`,
    CREATE: '/comments',
    RESOLVE: (id) => `/comments/${id}/resolve`,
    UNRESOLVE: (id) => `/comments/${id}/unresolve`,
  },
  NOTIFICATIONS: {
    LIST: '/notifications',
    UNREAD: '/notifications/unread',
    STATS: '/notifications/stats',
    MARK_READ: (id) => `/notifications/${id}/read`,
    MARK_ALL_READ: '/notifications/read-all',
  },
  USERS: {
    LIST: '/users',
    CREATE: '/users',
    GET: (id) => `/users/${id}`,
    UPDATE: (id) => `/users/${id}`,
  },
  TAGS: {
    LIST: '/tags',
    CREATE: '/tags',
    DELETE: (id) => `/tags/${id}`,
  },
}
