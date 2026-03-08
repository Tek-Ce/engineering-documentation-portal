import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { toast } from 'react-hot-toast'
import { X, Loader2, Save, ChevronDown, Check } from 'lucide-react'
import { documentsAPI, tagsAPI, projectsAPI } from '../api/client'
import { useAuthStore } from '../store/authStore'
import clsx from 'clsx'

function EditDocumentModal({ isOpen, onClose, document }) {
  const queryClient = useQueryClient()
  const { user, isAdmin } = useAuthStore()
  const [selectedTags, setSelectedTags] = useState([])
  const [selectedReviewers, setSelectedReviewers] = useState([])
  const [reviewerDropdownOpen, setReviewerDropdownOpen] = useState(false)
  const reviewerDropdownRef = useRef(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      title: document?.title || '',
      description: document?.description || '',
      status: document?.status || 'draft',
      document_type: document?.document_type || 'other',
    },
  })

  // Fetch tags
  const { data: tagsData } = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagsAPI.list(),
  })

  // Fetch project members
  const { data: membersData } = useQuery({
    queryKey: ['project-members', document?.project_id],
    queryFn: () => projectsAPI.getMembers(document?.project_id),
    enabled: !!document?.project_id,
  })

  // Determine if current user can set advanced statuses (approved/published/archived)
  const userProjectRole = (membersData || []).find(m => m.user_id === user?.id)?.role
  const isViewer = userProjectRole?.toLowerCase() === 'viewer'
  const isDocumentReviewer = !isViewer && (document?.reviewers || []).some(r => (r.id || r) === user?.id)
  const canSetAdvancedStatus = isAdmin() || userProjectRole?.toLowerCase() === 'owner'

  // Only non-viewer members can be assigned as reviewers
  const eligibleReviewers = (membersData || []).filter(m => m.role?.toLowerCase() !== 'viewer')

  // Close reviewer dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (reviewerDropdownRef.current && !reviewerDropdownRef.current.contains(e.target)) {
        setReviewerDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Initialize form and selections when modal opens
  useEffect(() => {
    if (document && isOpen) {
      reset({
        title: document.title,
        description: document.description || '',
        status: document.status,
        document_type: document.document_type,
      })

      if (document.tags) {
        setSelectedTags(document.tags.map(t => t.id || t))
      }
      if (document.reviewers) {
        setSelectedReviewers(document.reviewers.map(r => r.id || r))
      }
    }
  }, [document?.id, isOpen, reset])

  const updateMutation = useMutation({
    mutationFn: (data) => documentsAPI.update(document.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document', document.id] })
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      toast.success('Document updated successfully!')
      onClose()
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to update document')
    },
  })

  const onSubmit = (data) => {
    updateMutation.mutate({
      title: data.title,
      description: data.description || null,
      status: data.status,
      document_type: data.document_type,
      tag_ids: selectedTags,
      reviewer_ids: selectedReviewers,
    })
  }

  const toggleTag = (tagId) => {
    setSelectedTags(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    )
  }

  const toggleReviewer = (reviewerId) => {
    setSelectedReviewers(prev =>
      prev.includes(reviewerId) ? prev.filter(id => id !== reviewerId) : [...prev, reviewerId]
    )
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in px-4">
      <div className="relative bg-white rounded-2xl shadow-modal w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-scale-in">
        <form onSubmit={handleSubmit(onSubmit)}>
          {/* Header */}
          <div className="sticky top-0 bg-white flex items-center justify-between px-6 py-4 border-b border-surface-100">
            <h2 className="text-lg font-semibold text-surface-900">Edit Document Metadata</h2>
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-100 transition-colors">
              <X size={18} className="text-surface-500" />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-5">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-2">
                Title <span className="text-accent-red">*</span>
              </label>
              <input
                {...register('title', { required: 'Title is required' })}
                type="text"
                className="w-full px-4 py-2.5 bg-surface-50 border border-surface-200 rounded-xl text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all"
                placeholder="Document title"
              />
              {errors.title && (
                <p className="mt-1 text-sm text-accent-red">{errors.title.message}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-2">
                Description
              </label>
              <textarea
                {...register('description')}
                rows={3}
                className="w-full px-4 py-2.5 bg-surface-50 border border-surface-200 rounded-xl text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all resize-none"
                placeholder="Brief description of the document"
              />
            </div>

            {/* Document Type */}
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-2">
                Document Type <span className="text-accent-red">*</span>
              </label>
              <select
                {...register('document_type', { required: true })}
                className="w-full px-4 py-2.5 bg-surface-50 border border-surface-200 rounded-xl text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all"
              >
                <option value="guide">Guide</option>
                <option value="config">Configuration</option>
                <option value="sop">SOP (Standard Operating Procedure)</option>
                <option value="report">Report</option>
                <option value="diagram">Diagram</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-2">
                Status <span className="text-accent-red">*</span>
              </label>
              <select
                {...register('status', { required: true })}
                className="w-full px-4 py-2.5 bg-surface-50 border border-surface-200 rounded-xl text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all"
              >
                <option value="draft">Draft</option>
                <option value="review">In Review</option>
                {canSetAdvancedStatus && (
                  <>
                    <option value="approved">Approved</option>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                  </>
                )}
              </select>
              {!canSetAdvancedStatus && (
                <p className="mt-1 text-xs text-surface-400">Approved / Published / Archived can only be set by a reviewer or project owner.</p>
              )}
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-2">
                Tags (Optional)
              </label>
              <div className="flex flex-wrap gap-2">
                {tagsData?.tags?.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className={clsx(
                      'px-3 py-1.5 text-sm font-medium rounded-lg transition-all',
                      selectedTags.includes(tag.id)
                        ? 'bg-primary-600 text-white'
                        : 'bg-surface-200 text-surface-700 hover:bg-surface-300'
                    )}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Reviewers */}
            <div ref={reviewerDropdownRef}>
              <label className="block text-sm font-medium text-surface-700 mb-1.5">
                Reviewers (Optional)
              </label>
              {/* Trigger button */}
              <button
                type="button"
                onClick={() => setReviewerDropdownOpen(prev => !prev)}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-surface-50 border border-surface-200 rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
              >
                <span className={clsx('flex flex-wrap gap-1.5 flex-1 min-w-0', selectedReviewers.length === 0 && 'text-surface-400')}>
                  {selectedReviewers.length === 0
                    ? 'Select reviewers…'
                    : eligibleReviewers
                        .filter(m => selectedReviewers.includes(m.user_id))
                        .map(m => (
                          <span key={m.user_id} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-700">
                            {m.user_name}
                          </span>
                        ))
                  }
                </span>
                <ChevronDown size={16} className={clsx('ml-2 text-surface-400 flex-shrink-0 transition-transform duration-200', reviewerDropdownOpen && 'rotate-180')} />
              </button>

              {/* Dropdown list */}
              {reviewerDropdownOpen && (
                <div className="mt-1 border border-surface-200 rounded-xl bg-white shadow-lg overflow-hidden">
                  <div className="max-h-48 overflow-y-auto divide-y divide-surface-100">
                    {eligibleReviewers.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-surface-400">No eligible reviewers (viewers excluded)</p>
                    ) : eligibleReviewers.map((member) => {
                      const checked = selectedReviewers.includes(member.user_id)
                      return (
                        <button
                          key={member.user_id}
                          type="button"
                          onClick={() => toggleReviewer(member.user_id)}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-50 transition-colors text-left"
                        >
                          <div className={clsx(
                            'w-5 h-5 rounded flex items-center justify-center border flex-shrink-0 transition-colors',
                            checked ? 'bg-primary-600 border-primary-600' : 'border-surface-300'
                          )}>
                            {checked && <Check size={12} className="text-white" />}
                          </div>
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                            {member.user_name?.charAt(0) || '?'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-surface-900 truncate">{member.user_name}</p>
                            <p className="text-xs text-surface-500 capitalize">{member.role}</p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-white flex items-center justify-end gap-3 px-6 py-4 border-t border-surface-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-medium text-surface-600 hover:text-surface-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="px-5 py-2.5 bg-primary-600 text-white font-medium text-sm rounded-xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={16} />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default EditDocumentModal
