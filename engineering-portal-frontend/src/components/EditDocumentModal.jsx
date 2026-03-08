import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { toast } from 'react-hot-toast'
import { X, Loader2, Save } from 'lucide-react'
import { documentsAPI, tagsAPI, projectsAPI } from '../api/client'
import clsx from 'clsx'

function EditDocumentModal({ isOpen, onClose, document }) {
  const queryClient = useQueryClient()
  const [selectedTags, setSelectedTags] = useState([])
  const [selectedReviewers, setSelectedReviewers] = useState([])

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
                <option value="approved">Approved</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
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
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-3">
                Reviewers (Optional)
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {(membersData || []).map((member) => (
                  <label
                    key={member.user_id}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-surface-50 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedReviewers.includes(member.user_id)}
                      onChange={() => toggleReviewer(member.user_id)}
                      className="w-4 h-4 text-primary-600 border-surface-300 rounded focus:ring-2 focus:ring-primary-500/30"
                    />
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                        {member.user_name?.charAt(0) || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-surface-900 truncate">{member.user_name}</p>
                        <p className="text-xs text-surface-500 capitalize">{member.role}</p>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
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
