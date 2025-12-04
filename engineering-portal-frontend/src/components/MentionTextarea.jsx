import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { usersAPI, projectsAPI } from '../api/client'

export default function MentionTextarea({
  value,
  onChange,
  placeholder,
  className,
  rows = 3,
  projectId = null,
}) {
  const [showMentions, setShowMentions] = useState(false)
  const [mentionSearch, setMentionSearch] = useState('')
  const [mentionPosition, setMentionPosition] = useState(0)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 })
  const textareaRef = useRef(null)

  // Fetch project members if projectId is provided, otherwise fetch all users
  const { data: membersData } = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: () => projectsAPI.getMembers(projectId),
    enabled: showMentions && !!projectId,
  })

  const { data: usersData } = useQuery({
    queryKey: ['all-users'],
    queryFn: () => usersAPI.list(),
    enabled: showMentions && !projectId,
  })

  // Use project members if available, otherwise use all users
  // membersData is an array directly, usersData is wrapped in {users: [...]}
  const allUsers = projectId ? (membersData || []) : (usersData?.users || [])

  // Filter users based on search
  // Handle both field formats: user_name/user_email (from members API) and full_name/email (from users API)
  const filteredMembers = allUsers.filter(user => {
    const name = user.full_name || user.user_name || ''
    const email = user.email || user.user_email || ''
    return name.toLowerCase().includes(mentionSearch.toLowerCase()) ||
           email.toLowerCase().includes(mentionSearch.toLowerCase())
  })

  // Reset selected index when filtered list changes
  useEffect(() => {
    if (filteredMembers.length > 0 && selectedIndex >= filteredMembers.length) {
      setSelectedIndex(0)
    }
  }, [filteredMembers.length, selectedIndex])

  // Update dropdown position when mentions are shown
  useEffect(() => {
    if (showMentions && textareaRef.current) {
      const rect = textareaRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.top - 8, // 8px above the textarea
        left: rect.left,
        width: Math.min(rect.width, 448) // max-w-md = 448px
      })
    }
  }, [showMentions])

  const handleTextChange = (e) => {
    const text = e.target.value
    const cursorPosition = e.target.selectionStart

    // Detect @ symbol
    const textBeforeCursor = text.slice(0, cursorPosition)
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1)
      // Check if there's no space after @
      if (!textAfterAt.includes(' ')) {
        setMentionSearch(textAfterAt)
        setMentionPosition(lastAtIndex)
        setShowMentions(true)
      } else {
        setShowMentions(false)
      }
    } else {
      setShowMentions(false)
    }

    onChange(e)
  }

  const insertMention = (user) => {
    // Handle both field formats: user_email (from members API) and email (from users API)
    const email = user.email || user.user_email || ''
    const username = email.split('@')[0]

    const textBeforeMention = value.slice(0, mentionPosition)
    const textAfterMention = value.slice(mentionPosition + mentionSearch.length + 1)

    const newText = `${textBeforeMention}@${username} ${textAfterMention}`

    // Create synthetic event
    const syntheticEvent = {
      target: {
        value: newText,
        name: textareaRef.current?.name,
      }
    }

    onChange(syntheticEvent)
    setShowMentions(false)
    setMentionSearch('')

    // Focus back on textarea
    setTimeout(() => {
      textareaRef.current?.focus()
      const newCursorPos = mentionPosition + username.length + 2
      textareaRef.current?.setSelectionRange(newCursorPos, newCursorPos)
    }, 0)
  }

  const handleKeyDown = (e) => {
    if (!showMentions || filteredMembers.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev =>
          prev < filteredMembers.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => prev > 0 ? prev - 1 : prev)
        break
      case 'Enter':
        if (showMentions) {
          e.preventDefault()
          if (filteredMembers[selectedIndex]) {
            insertMention(filteredMembers[selectedIndex])
          }
        }
        break
      case 'Escape':
        e.preventDefault()
        setShowMentions(false)
        break
    }
  }

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleTextChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        rows={rows}
      />

      {/* Mention Dropdown - rendered via portal */}
      {showMentions && filteredMembers.length > 0 && createPortal(
        <div
          className="fixed bg-white border border-surface-200 rounded-xl shadow-xl max-h-64 overflow-hidden z-[9999]"
          style={{
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            width: `${dropdownPosition.width}px`,
            transform: 'translateY(-100%)'
          }}
        >
          <div className="px-3 py-2 bg-gradient-to-r from-primary-50 to-primary-100 border-b border-primary-200">
            <div className="flex items-center gap-2 text-xs font-medium text-primary-700">
              <span>💬</span>
              <span>Mention a team member</span>
              <span className="ml-auto text-primary-600 bg-white px-2 py-0.5 rounded">
                {filteredMembers.length} found
              </span>
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filteredMembers.map((user, index) => {
              // Handle both field formats: user_name/user_email (from members API) and full_name/email (from users API)
              const fullName = user.full_name || user.user_name || 'Unknown User'
              const email = user.email || user.user_email || ''
              const initials = fullName.split(' ').map(n => n[0]).join('').toUpperCase() || '?'
              const username = email.split('@')[0] || 'user'

              return (
                <button
                  key={user.id || user.user_id}
                  type="button"
                  onClick={() => insertMention(user)}
                  className={`w-full text-left px-3 py-2.5 hover:bg-primary-50 transition-all flex items-center gap-3 ${
                    index === selectedIndex ? 'bg-primary-50 border-l-2 border-primary-500' : 'border-l-2 border-transparent'
                  }`}
                >
                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {initials}
                  </div>

                  {/* User Info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-surface-900 truncate">
                      {fullName}
                    </div>
                    <div className="text-xs text-surface-500 flex items-center gap-2">
                      <span className="font-mono text-primary-600">@{username}</span>
                      <span>•</span>
                      <span className="px-1.5 py-0.5 bg-surface-100 rounded text-surface-600">
                        {user.role}
                      </span>
                    </div>
                  </div>

                  {/* Selection Indicator */}
                  {index === selectedIndex && (
                    <div className="w-1.5 h-1.5 rounded-full bg-primary-500 flex-shrink-0"></div>
                  )}
                </button>
              )
            })}
          </div>

          {/* Footer Hint */}
          <div className="px-3 py-2 bg-surface-50 border-t border-surface-200 text-xs text-surface-500 flex items-center gap-2">
            <span>⌨️</span>
            <span>Use ↑↓ to navigate, Enter to select, Esc to close</span>
          </div>
        </div>,
        document.body
      )}

      {/* Helper Text */}
      <div className="mt-1.5 text-xs text-surface-500 flex items-center gap-1">
        <span>💡</span>
        <span>Type <span className="font-mono bg-primary-50 text-primary-700 px-1.5 py-0.5 rounded">@</span> to mention team members</span>
      </div>
    </div>
  )
}
