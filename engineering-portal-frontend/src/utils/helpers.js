import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns'

// Format file size in human-readable format
export function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// Format date in a smart way
export function formatDate(date, options = {}) {
  const d = new Date(date)
  const { relative = false, includeTime = false } = options
  
  if (relative) {
    return formatDistanceToNow(d, { addSuffix: true })
  }
  
  if (isToday(d)) {
    return includeTime ? `Today at ${format(d, 'h:mm a')}` : 'Today'
  }
  
  if (isYesterday(d)) {
    return includeTime ? `Yesterday at ${format(d, 'h:mm a')}` : 'Yesterday'
  }
  
  return includeTime 
    ? format(d, 'MMM d, yyyy h:mm a')
    : format(d, 'MMM d, yyyy')
}

// Truncate text with ellipsis
export function truncate(str, length = 50) {
  if (!str) return ''
  if (str.length <= length) return str
  return str.slice(0, length) + '...'
}

// Generate initials from name
export function getInitials(name, maxLength = 2) {
  if (!name) return ''
  
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, maxLength)
}

// Capitalize first letter
export function capitalize(str) {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

// Generate a random color from a string (for avatars)
export function stringToColor(str) {
  if (!str) return '#4c6ef5'
  
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  
  const colors = [
    '#4c6ef5', // primary
    '#10b981', // green
    '#f59e0b', // amber
    '#06b6d4', // cyan
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#f97316', // orange
  ]
  
  return colors[Math.abs(hash) % colors.length]
}

// Debounce function
export function debounce(func, wait) {
  let timeout
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

// Get file extension
export function getFileExtension(filename) {
  if (!filename) return ''
  return filename.split('.').pop()?.toLowerCase() || ''
}

// Get file type category
export function getFileCategory(mimeType) {
  if (!mimeType) return 'file'
  
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  if (mimeType === 'application/pdf') return 'pdf'
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'spreadsheet'
  if (mimeType.includes('document') || mimeType.includes('word')) return 'document'
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'presentation'
  if (mimeType.startsWith('text/')) return 'text'
  
  return 'file'
}

// Copy text to clipboard
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch (err) {
    console.error('Failed to copy:', err)
    return false
  }
}

// Check if object is empty
export function isEmpty(obj) {
  if (!obj) return true
  if (Array.isArray(obj)) return obj.length === 0
  if (typeof obj === 'object') return Object.keys(obj).length === 0
  return false
}

// Parse query string
export function parseQueryString(queryString) {
  const params = new URLSearchParams(queryString)
  const result = {}
  for (const [key, value] of params) {
    result[key] = value
  }
  return result
}

// Sanitize HTML - escapes dangerous content while preserving safe highlight tags
// This prevents XSS attacks when rendering search result highlights
export function sanitizeHighlightHtml(html) {
  if (!html || typeof html !== 'string') return ''

  // First, escape all HTML entities
  const escaped = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')

  // Then, selectively restore safe highlight tags
  // Common highlight markers: <mark>, <strong>, <b>, <em>
  // The server should use these specific tags for highlighting
  const safeTagPatterns = [
    // <mark> and </mark>
    { escaped: '&lt;mark&gt;', safe: '<mark>' },
    { escaped: '&lt;/mark&gt;', safe: '</mark>' },
    // <strong> and </strong>
    { escaped: '&lt;strong&gt;', safe: '<strong>' },
    { escaped: '&lt;/strong&gt;', safe: '</strong>' },
    // <b> and </b>
    { escaped: '&lt;b&gt;', safe: '<b>' },
    { escaped: '&lt;/b&gt;', safe: '</b>' },
    // <em> and </em>
    { escaped: '&lt;em&gt;', safe: '<em>' },
    { escaped: '&lt;/em&gt;', safe: '</em>' },
  ]

  let result = escaped
  for (const pattern of safeTagPatterns) {
    result = result.split(pattern.escaped).join(pattern.safe)
  }

  return result
}
