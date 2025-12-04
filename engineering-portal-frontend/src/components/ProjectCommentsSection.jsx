import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MessageSquare, Send, Loader2, MoreVertical, Trash2, Check, X } from 'lucide-react'
import { projectCommentsAPI } from '../api/client'
import { useAuthStore } from '../store/authStore'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'react-hot-toast'
import clsx from 'clsx'
import MentionTextarea from './MentionTextarea'

function ProjectCommentsSection({ projectId }) {
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const [newComment, setNewComment] = useState('')
  const [replyingTo, setReplyingTo] = useState(null)
  const [replyContent, setReplyContent] = useState('')
  const [editingComment, setEditingComment] = useState(null)
  const [editContent, setEditContent] = useState('')

  // Fetch comments
  const { data: commentsData, isLoading } = useQuery({
    queryKey: ['project-comments', projectId],
    queryFn: () => projectCommentsAPI.list(projectId),
  })

  // Create comment mutation
  const createCommentMutation = useMutation({
    mutationFn: (data) => projectCommentsAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-comments', projectId] })
      setNewComment('')
      setReplyingTo(null)
      setReplyContent('')
      toast.success('Comment posted!')
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to post comment')
    },
  })

  // Update comment mutation
  const updateCommentMutation = useMutation({
    mutationFn: ({ id, data }) => projectCommentsAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-comments', projectId] })
      setEditingComment(null)
      setEditContent('')
      toast.success('Comment updated!')
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to update comment')
    },
  })

  // Delete comment mutation
  const deleteCommentMutation = useMutation({
    mutationFn: (id) => projectCommentsAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-comments', projectId] })
      toast.success('Comment deleted!')
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to delete comment')
    },
  })

  const handleSubmitComment = (e) => {
    e.preventDefault()
    if (!newComment.trim()) return

    createCommentMutation.mutate({
      project_id: projectId,
      content: newComment,
      parent_comment_id: null,
    })
  }

  const handleSubmitReply = (parentId) => {
    if (!replyContent.trim()) return

    createCommentMutation.mutate({
      project_id: projectId,
      content: replyContent,
      parent_comment_id: parentId,
    })
  }

  const handleUpdateComment = (commentId) => {
    if (!editContent.trim()) return

    updateCommentMutation.mutate({
      id: commentId,
      data: { content: editContent },
    })
  }

  const handleDeleteComment = (commentId) => {
    if (window.confirm('Are you sure you want to delete this comment?')) {
      deleteCommentMutation.mutate(commentId)
    }
  }

  const handleResolveToggle = (comment) => {
    updateCommentMutation.mutate({
      id: comment.id,
      data: { is_resolved: !comment.is_resolved },
    })
  }

  const startEditing = (comment) => {
    setEditingComment(comment.id)
    setEditContent(comment.content)
  }

  const cancelEditing = () => {
    setEditingComment(null)
    setEditContent('')
  }

  const CommentItem = ({ comment, isReply = false }) => {
    const isEditing = editingComment === comment.id
    const isReplying = replyingTo === comment.id
    const canModify = user?.id === comment.user_id || user?.role === 'ADMIN'

    return (
      <div className={clsx('flex gap-3', isReply && 'ml-12 mt-3')}>
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
          {comment.user_name?.charAt(0) || '?'}
        </div>

        <div className="flex-1 min-w-0">
          <div className={clsx(
            'rounded-xl p-4 transition-colors',
            comment.is_resolved ? 'bg-surface-100' : 'bg-white border border-surface-200'
          )}>
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <p className="font-medium text-surface-900">{comment.user_name || 'Unknown User'}</p>
                <p className="text-xs text-surface-500">
                  {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                  {comment.is_resolved && (
                    <span className="ml-2 text-accent-green">• Resolved</span>
                  )}
                </p>
              </div>

              {canModify && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleResolveToggle(comment)}
                    className="p-1.5 rounded-lg hover:bg-surface-100 transition-colors"
                    title={comment.is_resolved ? 'Mark as unresolved' : 'Mark as resolved'}
                  >
                    {comment.is_resolved ? (
                      <X size={16} className="text-surface-600" />
                    ) : (
                      <Check size={16} className="text-accent-green" />
                    )}
                  </button>
                  <button
                    onClick={() => startEditing(comment)}
                    className="p-1.5 rounded-lg hover:bg-surface-100 transition-colors"
                  >
                    <MoreVertical size={16} className="text-surface-600" />
                  </button>
                  <button
                    onClick={() => handleDeleteComment(comment.id)}
                    className="p-1.5 rounded-lg hover:bg-accent-red/10 transition-colors"
                  >
                    <Trash2 size={16} className="text-accent-red" />
                  </button>
                </div>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-2">
                <MentionTextarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  projectId={projectId}
                  placeholder="Edit your comment..."
                  className="w-full"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleUpdateComment(comment.id)}
                    disabled={updateCommentMutation.isPending}
                    className="px-3 py-1.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={cancelEditing}
                    className="px-3 py-1.5 text-surface-600 text-sm font-medium rounded-lg hover:bg-surface-100 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-surface-700 whitespace-pre-wrap break-words">{comment.content}</p>

                {!isReply && (
                  <button
                    onClick={() => setReplyingTo(comment.id)}
                    className="mt-3 text-sm text-primary-600 hover:text-primary-700 font-medium"
                  >
                    Reply
                  </button>
                )}
              </>
            )}
          </div>

          {/* Reply Form */}
          {isReplying && (
            <div className="mt-3 ml-12">
              <MentionTextarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                projectId={projectId}
                placeholder="Write a reply..."
                className="w-full mb-2"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSubmitReply(comment.id)}
                  disabled={createCommentMutation.isPending}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
                >
                  {createCommentMutation.isPending ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Send size={14} />
                  )}
                  Post Reply
                </button>
                <button
                  onClick={() => {
                    setReplyingTo(null)
                    setReplyContent('')
                  }}
                  className="px-3 py-1.5 text-surface-600 text-sm font-medium rounded-lg hover:bg-surface-100 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Replies */}
          {comment.replies && comment.replies.length > 0 && (
            <div className="mt-3 space-y-3">
              {comment.replies.map((reply) => (
                <CommentItem key={reply.id} comment={reply} isReply={true} />
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-surface-200 p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 size={32} className="animate-spin text-primary-500" />
        </div>
      </div>
    )
  }

  const comments = commentsData?.comments || []

  return (
    <div className="bg-white rounded-2xl border border-surface-200 p-6">
      <div className="flex items-center gap-2 mb-6">
        <MessageSquare size={20} className="text-surface-600" />
        <h2 className="text-lg font-semibold text-surface-900">Project Discussion</h2>
        <span className="text-sm text-surface-500">({comments.length} comments)</span>
      </div>

      {/* New Comment Form */}
      <form onSubmit={handleSubmitComment} className="mb-6">
        <MentionTextarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          projectId={projectId}
          placeholder="Start a discussion about this project... Use @ to mention team members"
          className="w-full mb-3"
        />
        <button
          type="submit"
          disabled={createCommentMutation.isPending || !newComment.trim()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white font-medium rounded-xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {createCommentMutation.isPending ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Posting...
            </>
          ) : (
            <>
              <Send size={16} />
              Post Comment
            </>
          )}
        </button>
      </form>

      {/* Comments List */}
      {comments.length === 0 ? (
        <div className="text-center py-12">
          <MessageSquare size={48} className="mx-auto text-surface-300 mb-4" />
          <p className="text-surface-500 mb-2">No comments yet</p>
          <p className="text-sm text-surface-400">Start the conversation about this project</p>
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <CommentItem key={comment.id} comment={comment} />
          ))}
        </div>
      )}
    </div>
  )
}

export default ProjectCommentsSection
