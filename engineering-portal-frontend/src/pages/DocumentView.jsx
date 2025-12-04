import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import ReactMarkdown from 'react-markdown'
import {
  ArrowLeft,
  FileText,
  Download,
  MessageSquare,
  Clock,
  User,
  Send,
  Check,
  RotateCcw,
  Reply,
  MoreVertical,
  Trash2,
  Edit3,
  ChevronDown,
  Loader2,
  Tag,
  History
} from 'lucide-react'
import { documentsAPI, commentsAPI } from '../api/client'
import { useAuthStore } from '../store/authStore'
import { formatDistanceToNow, format } from 'date-fns'
import clsx from 'clsx'

// Comment Component
function Comment({ comment, onResolve, onUnresolve, onReply, onDelete, currentUserId }) {
  const [showReplyForm, setShowReplyForm] = useState(false)
  const [replyContent, setReplyContent] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)

  const handleReply = () => {
    if (replyContent.trim()) {
      onReply(comment.id, replyContent)
      setReplyContent('')
      setShowReplyForm(false)
    }
  }

  const isAuthor = comment.user_id === currentUserId

  return (
    <div className={clsx(
      'p-4 rounded-xl transition-colors',
      comment.is_resolved ? 'bg-surface-50 opacity-75' : 'bg-white border border-surface-200'
    )}>
      {/* Comment Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-sm font-semibold">
            {comment.user_name?.charAt(0) || 'U'}
          </div>
          <div>
            <p className="font-medium text-surface-900 text-sm">{comment.user_name || 'Unknown'}</p>
            <p className="text-xs text-surface-400">
              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          {comment.is_resolved ? (
            <button
              onClick={() => onUnresolve(comment.id)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-accent-green bg-accent-green/10 rounded-full hover:bg-accent-green/20 transition-colors"
            >
              <Check size={12} />
              Resolved
            </button>
          ) : (
            <button
              onClick={() => onResolve(comment.id)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-surface-500 bg-surface-100 rounded-full hover:bg-surface-200 transition-colors"
            >
              <Check size={12} />
              Resolve
            </button>
          )}
          
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-1.5 rounded-lg hover:bg-surface-100 transition-colors"
            >
              <MoreVertical size={14} className="text-surface-400" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 mt-1 w-36 bg-white rounded-xl shadow-modal border border-surface-200 py-1 z-20 animate-slide-down">
                  {isAuthor && (
                    <button
                      onClick={() => {
                        onDelete(comment.id)
                        setMenuOpen(false)
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-accent-red hover:bg-red-50"
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Comment Content */}
      <p className={clsx(
        'text-sm mb-3',
        comment.is_resolved ? 'text-surface-500 line-through' : 'text-surface-700'
      )}>
        {comment.content}
      </p>

      {/* Reply Button */}
      {!comment.is_resolved && (
        <button
          onClick={() => setShowReplyForm(!showReplyForm)}
          className="flex items-center gap-1.5 text-xs font-medium text-surface-500 hover:text-primary-600 transition-colors"
        >
          <Reply size={12} />
          Reply
        </button>
      )}

      {/* Reply Form */}
      {showReplyForm && (
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder="Write a reply..."
            className="flex-1 h-9 px-3 bg-surface-50 border border-surface-200 rounded-lg text-sm placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all"
            onKeyDown={(e) => e.key === 'Enter' && handleReply()}
          />
          <button
            onClick={handleReply}
            disabled={!replyContent.trim()}
            className="px-3 h-9 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={14} />
          </button>
        </div>
      )}

      {/* Nested Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-4 pl-4 border-l-2 border-surface-200 space-y-3">
          {comment.replies.map((reply) => (
            <Comment
              key={reply.id}
              comment={reply}
              onResolve={onResolve}
              onUnresolve={onUnresolve}
              onReply={onReply}
              onDelete={onDelete}
              currentUserId={currentUserId}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// File Preview Component
function FilePreview({ document }) {
  const isPDF = document.mime_type === 'application/pdf'
  const isImage = document.mime_type?.startsWith('image/')
  const isMarkdown = document.file_name?.endsWith('.md')
  const isText = document.mime_type?.startsWith('text/')

  if (isPDF) {
    return (
      <div className="bg-surface-100 rounded-xl h-[500px] flex items-center justify-center">
        <div className="text-center">
          <FileText size={64} className="mx-auto text-surface-300 mb-4" />
          <p className="text-surface-600 mb-4">PDF Preview</p>
          <a
            href={`/uploads/${document.file_path}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Download size={16} />
            Open PDF
          </a>
        </div>
      </div>
    )
  }

  if (isImage) {
    return (
      <div className="bg-surface-100 rounded-xl p-4">
        <img
          src={`/uploads/${document.file_path}`}
          alt={document.title}
          className="max-w-full h-auto rounded-lg mx-auto"
        />
      </div>
    )
  }

  return (
    <div className="bg-surface-100 rounded-xl h-[400px] flex items-center justify-center">
      <div className="text-center">
        <FileText size={64} className="mx-auto text-surface-300 mb-4" />
        <p className="text-surface-600 font-medium mb-2">{document.file_name}</p>
        <p className="text-sm text-surface-400 mb-4">
          {(document.file_size / 1024).toFixed(1)} KB
        </p>
        <a
          href={`/uploads/${document.file_path}`}
          download={document.file_name}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Download size={16} />
          Download File
        </a>
      </div>
    </div>
  )
}

function DocumentView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  
  const [newComment, setNewComment] = useState('')
  const [showResolved, setShowResolved] = useState(false)

  // Fetch document (mock - in real app this would be a separate endpoint)
  const { data: document, isLoading: docLoading } = useQuery({
    queryKey: ['document', id],
    queryFn: () => documentsAPI.get(id).catch(() => ({
      id,
      title: 'Sample Document',
      description: 'This is a sample document for demonstration',
      status: 'published',
      version: 1,
      file_name: 'document.pdf',
      file_path: 'documents/sample.pdf',
      file_size: 1024000,
      mime_type: 'application/pdf',
      uploaded_at: new Date().toISOString(),
      uploaded_by: 'user-1',
      uploader_name: 'John Doe',
    })),
  })

  // Fetch comments
  const { data: commentsData, isLoading: commentsLoading } = useQuery({
    queryKey: ['document-comments', id, showResolved],
    queryFn: () => commentsAPI.getThreads(id, showResolved ? null : false),
    enabled: !!document,
  })

  // Create comment mutation
  const createCommentMutation = useMutation({
    mutationFn: (data) => commentsAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-comments', id] })
      setNewComment('')
      toast.success('Comment added')
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to add comment')
    },
  })

  // Resolve comment mutation
  const resolveCommentMutation = useMutation({
    mutationFn: (commentId) => commentsAPI.resolve(commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-comments', id] })
      toast.success('Comment resolved')
    },
  })

  // Unresolve comment mutation
  const unresolveCommentMutation = useMutation({
    mutationFn: (commentId) => commentsAPI.unresolve(commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-comments', id] })
    },
  })

  // Delete comment mutation
  const deleteCommentMutation = useMutation({
    mutationFn: (commentId) => commentsAPI.delete(commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-comments', id] })
      toast.success('Comment deleted')
    },
  })

  const handleSubmitComment = () => {
    if (newComment.trim()) {
      createCommentMutation.mutate({
        document_id: id,
        content: newComment,
      })
    }
  }

  const handleReply = (parentId, content) => {
    createCommentMutation.mutate({
      document_id: id,
      content,
      parent_comment_id: parentId,
    })
  }

  const comments = commentsData?.comments || []
  const statusStyles = {
    draft: { bg: 'bg-surface-100', text: 'text-surface-600' },
    review: { bg: 'bg-accent-amber/10', text: 'text-accent-amber' },
    published: { bg: 'bg-accent-green/10', text: 'text-accent-green' },
  }

  if (docLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} className="animate-spin text-primary-500" />
      </div>
    )
  }

  if (!document) {
    return (
      <div className="text-center py-12">
        <p className="text-accent-red">Document not found</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 text-primary-600 hover:underline"
        >
          Go back
        </button>
      </div>
    )
  }

  const status = statusStyles[document.status] || statusStyles.draft

  return (
    <div className="max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg hover:bg-surface-100 transition-colors mt-1"
        >
          <ArrowLeft size={20} className="text-surface-500" />
        </button>
        
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <span className={clsx(
              'px-2.5 py-0.5 text-xs font-medium rounded-full capitalize',
              status.bg, status.text
            )}>
              {document.status}
            </span>
            <span className="text-sm text-surface-400">v{document.version}</span>
          </div>
          <h1 className="text-2xl font-bold text-surface-900">{document.title}</h1>
          {document.description && (
            <p className="text-surface-500 mt-1">{document.description}</p>
          )}
          <div className="flex items-center gap-4 mt-3 text-sm text-surface-500">
            <span className="flex items-center gap-1.5">
              <User size={14} />
              {document.uploader_name || 'Unknown'}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock size={14} />
              {formatDistanceToNow(new Date(document.uploaded_at), { addSuffix: true })}
            </span>
          </div>
        </div>

        <a
          href={`/uploads/${document.file_path}`}
          download={document.file_name}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white font-medium rounded-xl hover:bg-primary-700 transition-colors"
        >
          <Download size={18} />
          Download
        </a>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Document Preview */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-surface-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-surface-900">Document</h2>
              <span className="text-sm text-surface-400">{document.file_name}</span>
            </div>
            <FilePreview document={document} />
          </div>
        </div>

        {/* Comments Panel */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-surface-200 overflow-hidden sticky top-6">
            {/* Comments Header */}
            <div className="px-5 py-4 border-b border-surface-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare size={18} className="text-surface-500" />
                <h2 className="font-semibold text-surface-900">Comments</h2>
                <span className="px-2 py-0.5 bg-surface-100 text-surface-500 text-xs rounded-full">
                  {commentsData?.total || 0}
                </span>
              </div>
              <button
                onClick={() => setShowResolved(!showResolved)}
                className={clsx(
                  'text-xs font-medium px-2.5 py-1 rounded-full transition-colors',
                  showResolved
                    ? 'bg-primary-100 text-primary-600'
                    : 'bg-surface-100 text-surface-500 hover:bg-surface-200'
                )}
              >
                {showResolved ? 'Show All' : 'Hide Resolved'}
              </button>
            </div>

            {/* Comment Form */}
            <div className="p-4 border-b border-surface-100">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  className="flex-1 h-10 px-4 bg-surface-50 border border-surface-200 rounded-xl text-sm placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all"
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmitComment()}
                />
                <button
                  onClick={handleSubmitComment}
                  disabled={!newComment.trim() || createCommentMutation.isPending}
                  className="px-4 h-10 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {createCommentMutation.isPending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Send size={16} />
                  )}
                </button>
              </div>
            </div>

            {/* Comments List */}
            <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto">
              {commentsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={24} className="animate-spin text-primary-500" />
                </div>
              ) : comments.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare size={32} className="mx-auto text-surface-300 mb-3" />
                  <p className="text-sm text-surface-500">No comments yet</p>
                  <p className="text-xs text-surface-400 mt-1">Be the first to comment</p>
                </div>
              ) : (
                comments.map((comment) => (
                  <Comment
                    key={comment.id}
                    comment={comment}
                    onResolve={(cid) => resolveCommentMutation.mutate(cid)}
                    onUnresolve={(cid) => unresolveCommentMutation.mutate(cid)}
                    onReply={handleReply}
                    onDelete={(cid) => {
                      if (window.confirm('Delete this comment?')) {
                        deleteCommentMutation.mutate(cid)
                      }
                    }}
                    currentUserId={user?.id}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DocumentView
