import { useState, useEffect, memo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { commentsAPI, documentsAPI } from '../api/client'
import { toast } from 'react-hot-toast'
import { MessageSquare, Send, Check, X, Trash2, Edit2, AtSign, ChevronDown, ChevronUp, Reply } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import MentionTextarea from './MentionTextarea'

const REPLY_COLLAPSE_THRESHOLD = 3

// Extracted reply form component to prevent re-mounting on parent state changes
const ReplyForm = memo(function ReplyForm({
  commentId,
  projectId,
  parentAuthor,
  onSubmit,
  onCancel,
  isPending
}) {
  const [replyContent, setReplyContent] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!replyContent.trim()) return
    onSubmit(replyContent, commentId)
    setReplyContent('')
  }

  return (
    <div className="ml-4 sm:ml-6 md:ml-10 mt-3 pl-4 sm:pl-5 border-l-4 border-primary-300 bg-primary-50/30 rounded-r-xl -mr-1">
      <p className="text-xs font-medium text-primary-700 mb-2 flex items-center gap-1.5">
        <Reply size={12} />
        Replying to {parentAuthor || 'this comment'}
      </p>
      <form onSubmit={handleSubmit} className="bg-white rounded-xl p-3 sm:p-4 border border-primary-100 shadow-sm">
        <MentionTextarea
          value={replyContent}
          onChange={(e) => setReplyContent(e.target.value)}
          placeholder="Write a reply... (use @ to mention someone)"
          className="w-full px-3 py-2.5 border border-surface-200 rounded-lg text-surface-900 focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 bg-surface-50/50"
          rows={3}
          projectId={projectId}
        />
        <div className="flex gap-2 mt-3 flex-wrap">
          <button
            type="submit"
            disabled={!replyContent.trim() || isPending}
            className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4 mr-2" />
            {isPending ? 'Sending…' : 'Reply'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center px-4 py-2 border border-surface-200 text-sm font-medium rounded-lg text-surface-700 bg-white hover:bg-surface-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
})

export default function CommentsSection({ documentId }) {
  // Fetch document to get project ID
  const { data: documentData } = useQuery({
    queryKey: ['document', documentId],
    queryFn: () => documentsAPI.get(documentId),
  })

  // Derive projectId directly from documentData (no useState needed)
  const projectId = documentData?.project_id || null
  const [newComment, setNewComment] = useState('')
  const [replyToId, setReplyToId] = useState(null)
  const [editingComment, setEditingComment] = useState(null)
  const [editContent, setEditContent] = useState('')
  const queryClient = useQueryClient()

  // Fetch comments
  const { data: commentsData, isLoading } = useQuery({
    queryKey: ['comments', documentId],
    queryFn: () => commentsAPI.getDocumentComments(documentId),
  })

  // Auto-scroll to newest comment when comments change
  useEffect(() => {
    const el = document.getElementById('comments-list')
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  }, [commentsData])

  // Create comment mutation
  const createCommentMutation = useMutation({
    mutationFn: (data) => commentsAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', documentId] })
      setNewComment('')
      setReplyToId(null)
      toast.success('Comment added')
    },
    onError: () => {
      toast.error('Failed to add comment')
    },
  })

  // Update comment mutation
  const updateCommentMutation = useMutation({
    mutationFn: ({ id, data }) => commentsAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', documentId] })
      setEditingComment(null)
      setEditContent('')
      toast.success('Comment updated')
    },
    onError: () => {
      toast.error('Failed to update comment')
    },
  })

  // Delete comment mutation
  const deleteCommentMutation = useMutation({
    mutationFn: (id) => commentsAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', documentId] })
      toast.success('Comment deleted')
    },
    onError: () => {
      toast.error('Failed to delete comment')
    },
  })

  // Resolve/Unresolve comment mutation
  const resolveCommentMutation = useMutation({
    mutationFn: ({ id, resolve }) =>
      resolve ? commentsAPI.resolve(id) : commentsAPI.unresolve(id),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['comments', documentId] })
      toast.success(variables.resolve ? 'Comment resolved' : 'Comment unresolved')
    },
    onError: () => {
      toast.error('Failed to update comment status')
    },
  })

  const handleSubmitComment = (e) => {
    e.preventDefault()
    if (!newComment.trim()) return

    createCommentMutation.mutate({
      document_id: documentId,
      content: newComment,
      parent_comment_id: null,
    })
  }

  // Handle reply submission from ReplyForm component
  const handleSubmitReply = (content, parentCommentId) => {
    createCommentMutation.mutate({
      document_id: documentId,
      content: content,
      parent_comment_id: parentCommentId,
    })
  }

  const handleEditComment = (comment) => {
    setEditingComment(comment.id)
    setEditContent(comment.content)
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

  const handleToggleResolve = (comment) => {
    resolveCommentMutation.mutate({
      id: comment.id,
      resolve: !comment.is_resolved,
    })
  }

  // Highlight @mentions in comment text
  const highlightMentions = (text) => {
    if (!text) return text

    const mentionRegex = /@([a-zA-Z0-9._-]+(?:@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})?)/g
    const parts = []
    let lastIndex = 0
    let match

    while ((match = mentionRegex.exec(text)) !== null) {
      // Add text before mention
      if (match.index > lastIndex) {
        parts.push(
          <span key={`text-${lastIndex}`}>{text.slice(lastIndex, match.index)}</span>
        )
      }

      // Add highlighted mention
      parts.push(
        <span
          key={`mention-${match.index}`}
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-primary-100 text-primary-700 rounded font-medium"
        >
          <AtSign className="w-3 h-3" />
          {match[1]}
        </span>
      )

      lastIndex = match.index + match[0].length
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(<span key={`text-${lastIndex}`}>{text.slice(lastIndex)}</span>)
    }

    return parts.length > 0 ? parts : text
  }

  // Build full tree: any comment can have replies (thread-after-thread)
  const sortReplies = (node) => {
    if (node.replies && node.replies.length > 0) {
      node.replies.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      node.replies.forEach(sortReplies)
    }
  }

  const organizeThreads = (comments) => {
    const commentMap = {}
    const threads = []

    comments.forEach((comment) => {
      commentMap[comment.id] = { ...comment, replies: [] }
    })

    comments.forEach((comment) => {
      if (comment.parent_comment_id && commentMap[comment.parent_comment_id]) {
        commentMap[comment.parent_comment_id].replies.push(commentMap[comment.id])
      } else if (!comment.parent_comment_id) {
        threads.push(commentMap[comment.id])
      }
    })

    // Sort every level: replies oldest first, top-level newest first
    threads.forEach(sortReplies)
    threads.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

    return threads
  }

  const [collapsedThreads, setCollapsedThreads] = useState(new Set())

  const toggleThreadCollapse = (commentId) => {
    setCollapsedThreads((prev) => {
      const next = new Set(prev)
      if (next.has(commentId)) next.delete(commentId)
      else next.add(commentId)
      return next
    })
  }

  const renderComment = (comment, isReply = false, parentAuthor = null, depth = 0) => {
    const isEditing = editingComment === comment.id
    const replyCount = comment.replies?.length ?? 0
    const hasManyReplies = replyCount > REPLY_COLLAPSE_THRESHOLD
    const isCollapsed = collapsedThreads.has(comment.id)
    const visibleReplies = hasManyReplies && isCollapsed
      ? comment.replies.slice(0, REPLY_COLLAPSE_THRESHOLD)
      : (comment.replies || [])
    const hiddenCount = (comment.replies?.length ?? 0) - visibleReplies.length
    const depthCap = Math.min(depth, 3)
    const threadIndent = isReply
      ? `ml-4 sm:ml-6 ${depthCap >= 1 ? 'md:ml-8' : ''} ${depthCap >= 2 ? 'lg:ml-10' : ''} ${depthCap >= 3 ? 'xl:ml-12' : ''}`
      : ''
    const borderClass = isReply ? 'border-l-4 border-primary-300 pl-4 sm:pl-5' : ''

    return (
      <div
        key={comment.id}
        className={`${isReply ? `mt-3 ${threadIndent} ${borderClass}` : 'mb-4'}`}
      >
        <div
          className={`rounded-xl border p-3 sm:p-4 ${
            comment.is_resolved ? 'opacity-75 bg-surface-50 border-surface-200' : 'bg-white border-surface-200'
          } ${isReply ? 'bg-surface-50/70 border-primary-100' : 'shadow-sm'}`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0 overflow-hidden">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="font-semibold text-surface-900">
                  {comment.user_name || 'Unknown User'}
                </span>
                {parentAuthor && isReply && (
                  <span className="text-xs text-primary-600 font-medium flex items-center gap-1 bg-primary-50 px-2 py-0.5 rounded">
                    <Reply size={10} />
                    {parentAuthor}
                  </span>
                )}
                <span className="text-xs text-surface-500">
                  {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                </span>
                {replyCount > 0 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-700">
                    {replyCount} repl{replyCount === 1 ? 'y' : 'ies'}
                  </span>
                )}
                {comment.is_resolved && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-accent-green/10 text-accent-green">
                    <Check className="w-3 h-3 mr-1" />
                    Resolved
                  </span>
                )}
              </div>

              {isEditing ? (
                <div className="space-y-2">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full px-3 py-2 border border-surface-200 rounded-lg focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 resize-y text-surface-900"
                    rows={3}
                  />
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => handleUpdateComment(comment.id)}
                      className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditingComment(null)
                        setEditContent('')
                      }}
                      className="inline-flex items-center px-3 py-1.5 border border-surface-200 text-sm font-medium rounded-lg text-surface-700 bg-white hover:bg-surface-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-surface-700 whitespace-pre-wrap break-words overflow-hidden max-w-full text-sm sm:text-base" style={{ wordWrap: 'break-word', overflowWrap: 'break-word' }}>
                  {highlightMentions(comment.content)}
                </p>
              )}
            </div>

            {!isEditing && (
              <div className="flex items-center gap-0.5 sm:gap-1 ml-2 flex-shrink-0">
                <button
                  onClick={() => handleToggleResolve(comment)}
                  className="p-1.5 text-surface-400 hover:text-accent-green rounded-lg hover:bg-surface-100"
                  title={comment.is_resolved ? 'Mark unresolved' : 'Mark resolved'}
                >
                  {comment.is_resolved ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => handleEditComment(comment)}
                  className="p-1.5 text-surface-400 hover:text-primary-600 rounded-lg hover:bg-surface-100"
                  title="Edit"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteComment(comment.id)}
                  className="p-1.5 text-surface-400 hover:text-accent-red rounded-lg hover:bg-red-50"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {!isEditing && (
            <button
              type="button"
              onClick={() => setReplyToId(replyToId === comment.id ? null : comment.id)}
              className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 transition-colors"
            >
              <Reply size={14} />
              Reply
              {replyCount > 0 && (
                <span className="text-primary-500 font-normal">({replyCount})</span>
              )}
            </button>
          )}
        </div>

        {/* Replies with optional collapse */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-2 space-y-0">
            {visibleReplies.map((reply) => renderComment(reply, true, comment.user_name, depth + 1))}
            {hiddenCount > 0 && (
              <button
                type="button"
                onClick={() => toggleThreadCollapse(comment.id)}
                className="mt-3 ml-4 sm:ml-6 pl-4 py-2 flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700 bg-primary-50/50 hover:bg-primary-50 rounded-lg border-l-4 border-primary-200 -ml-px"
              >
                <ChevronDown size={16} />
                Show {hiddenCount} more reply{hiddenCount !== 1 ? 'ies' : ''}
              </button>
            )}
            {hasManyReplies && !isCollapsed && (
              <button
                type="button"
                onClick={() => toggleThreadCollapse(comment.id)}
                className="mt-2 ml-4 sm:ml-6 pl-4 flex items-center gap-2 text-xs text-surface-500 hover:text-surface-700"
              >
                <ChevronUp size={14} />
                Collapse replies
              </button>
            )}
          </div>
        )}

        {replyToId === comment.id && (
          <ReplyForm
            commentId={comment.id}
            projectId={projectId}
            parentAuthor={comment.user_name}
            onSubmit={handleSubmitReply}
            onCancel={() => setReplyToId(null)}
            isPending={createCommentMutation.isPending}
          />
        )}
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-surface-200 p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-surface-200 border-t-primary-500" />
        </div>
      </div>
    )
  }

  const comments = commentsData?.comments || []
  const threads = organizeThreads(comments)

  return (
    <div className="bg-white rounded-xl border border-surface-200 p-3 sm:p-6">
      <h3 className="text-base sm:text-lg font-semibold text-surface-900 mb-3 sm:mb-4 flex items-center">
        <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-primary-600" />
        Comments ({comments.length})
      </h3>

      {!replyToId && (
        <form onSubmit={handleSubmitComment} className="mb-6">
          <MentionTextarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment... (use @ to mention project members)"
            className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-surface-200 rounded-xl text-surface-900 text-sm sm:text-base focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 bg-surface-50"
            rows={3}
            projectId={projectId}
          />
          <button
            type="submit"
            disabled={!newComment.trim() || createCommentMutation.isPending}
            className="mt-2 inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium rounded-xl text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
          >
            <Send className="w-4 h-4 mr-2" />
            {createCommentMutation.isPending ? 'Posting...' : 'Post Comment'}
          </button>
        </form>
      )}

      {threads.length === 0 ? (
        <div className="text-center py-8 text-surface-500">
          <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-30 text-surface-300" />
          <p>No comments yet. Be the first to comment!</p>
        </div>
      ) : (
        <div id="comments-list" className="space-y-2 max-h-[65vh] overflow-auto pr-1">
          {threads.map((thread) => renderComment(thread, false, null))}
        </div>
      )}
    </div>
  )
}
