import { useState, useEffect, memo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { commentsAPI, documentsAPI } from '../api/client'
import { toast } from 'react-hot-toast'
import { MessageSquare, Send, Check, X, Trash2, Edit2, AtSign } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import MentionTextarea from './MentionTextarea'

// Extracted reply form component to prevent re-mounting on parent state changes
const ReplyForm = memo(function ReplyForm({
  commentId,
  projectId,
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
    <div className="ml-6 sm:ml-12 mt-3">
      <form onSubmit={handleSubmit} className="bg-gray-50 rounded-lg p-3">
        <MentionTextarea
          value={replyContent}
          onChange={(e) => setReplyContent(e.target.value)}
          placeholder="Write a reply... (use @ to mention someone)"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          rows={2}
          projectId={projectId}
        />
        <div className="flex gap-2 mt-2">
          <button
            type="submit"
            disabled={!replyContent.trim() || isPending}
            className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4 mr-2" />
            Reply
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
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
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-medium"
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

  // Organize comments into threads
  const organizeThreads = (comments) => {
    const commentMap = {}
    const threads = []

    // Create comment map
    comments.forEach((comment) => {
      commentMap[comment.id] = { ...comment, replies: [] }
    })

    // Organize into threads
    comments.forEach((comment) => {
      if (comment.parent_comment_id && commentMap[comment.parent_comment_id]) {
        commentMap[comment.parent_comment_id].replies.push(commentMap[comment.id])
      } else if (!comment.parent_comment_id) {
        threads.push(commentMap[comment.id])
      }
    })

    return threads
  }

  const renderComment = (comment, isReply = false) => {
    const isEditing = editingComment === comment.id

    return (
      <div key={comment.id} className={`${isReply ? 'ml-6 sm:ml-12 mt-3' : 'mb-4'}`}>
        <div className={`bg-white rounded-lg border border-gray-200 p-3 sm:p-4 ${
          comment.is_resolved ? 'opacity-60' : ''
        }`}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0 overflow-hidden">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="font-medium text-gray-900">
                  {comment.user_name || 'Unknown User'}
                </span>
                <span className="text-xs text-gray-500">
                  {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                </span>
                {comment.is_resolved && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
                    rows={3}
                  />
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => handleUpdateComment(comment.id)}
                      className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditingComment(null)
                        setEditContent('')
                      }}
                      className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-gray-700 whitespace-pre-wrap break-words word-break overflow-hidden max-w-full" style={{ wordWrap: 'break-word', overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                  {highlightMentions(comment.content)}
                </p>
              )}
            </div>

            {!isEditing && (
              <div className="flex items-center gap-1 ml-4">
                <button
                  onClick={() => handleToggleResolve(comment)}
                  className="p-1 text-gray-400 hover:text-green-600 rounded"
                  title={comment.is_resolved ? 'Mark as unresolved' : 'Mark as resolved'}
                >
                  {comment.is_resolved ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => handleEditComment(comment)}
                  className="p-1 text-gray-400 hover:text-blue-600 rounded"
                  title="Edit comment"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteComment(comment.id)}
                  className="p-1 text-gray-400 hover:text-red-600 rounded"
                  title="Delete comment"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {!isReply && !isEditing && (
            <button
              onClick={() => setReplyToId(replyToId === comment.id ? null : comment.id)}
              className="mt-2 text-sm text-blue-600 hover:text-blue-700"
            >
              Reply
            </button>
          )}
        </div>

        {/* Render replies */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-2">
            {comment.replies.map((reply) => renderComment(reply, true))}
          </div>
        )}

        {/* Reply form - using separate component to maintain focus */}
        {replyToId === comment.id && (
          <ReplyForm
            commentId={comment.id}
            projectId={projectId}
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
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    )
  }

  const comments = commentsData?.comments || []
  const threads = organizeThreads(comments)

  return (
    <div className="bg-white rounded-xl shadow-sm p-3 sm:p-6">
      <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center">
        <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-blue-600" />
        Comments ({comments.length})
      </h3>

      {/* New comment form */}
      {!replyToId && (
        <form onSubmit={handleSubmitComment} className="mb-6">
          <MentionTextarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment... (use @ to mention project members)"
            className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg text-sm sm:text-base focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={3}
            projectId={projectId}
          />
          <button
            type="submit"
            disabled={!newComment.trim() || createCommentMutation.isPending}
            className="mt-2 inline-flex items-center justify-center px-3 sm:px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
          >
            <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2" />
            {createCommentMutation.isPending ? 'Posting...' : 'Post Comment'}
          </button>
        </form>
      )}

      {/* Comments list */}
      {threads.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-20" />
          <p>No comments yet. Be the first to comment!</p>
        </div>
      ) : (
        <div id="comments-list" className="space-y-4 max-h-[60vh] overflow-auto">
          {threads.map((thread) => renderComment(thread))}
        </div>
      )}
    </div>
  )
}
