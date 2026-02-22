import { useState, useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { toast } from 'react-hot-toast'
import {
  FileText,
  Download,
  Clock,
  User,
  Upload,
  X,
  Loader2,
  ArrowLeft,
  History,
  Eye,
  Edit3,
  Trash2,
  CheckCircle,
  XCircle,
  Send,
} from 'lucide-react'
import { documentsAPI } from '../api/client'
import { useAuthStore } from '../store/authStore'
import { formatDistanceToNow, format } from 'date-fns'
import clsx from 'clsx'
import ReactMarkdown from 'react-markdown'
import CommentsSection from '../components/CommentsSection'
import TagsSection from '../components/TagsSection'
import EditDocumentModal from '../components/EditDocumentModal'

// Upload New Version Modal
function UploadVersionModal({ isOpen, onClose, documentId }) {
  const queryClient = useQueryClient()
  const fileInputRef = useRef(null)
  const [selectedFile, setSelectedFile] = useState(null)

  const {
    register,
    handleSubmit,
    reset,
  } = useForm({
    defaultValues: {
      changeNotes: '',
    },
  })

  const uploadMutation = useMutation({
    mutationFn: (data) => documentsAPI.uploadNewVersion(
      documentId,
      selectedFile,
      data.changeNotes
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document', documentId] })
      queryClient.invalidateQueries({ queryKey: ['document-versions', documentId] })
      toast.success('New version uploaded successfully!')
      reset()
      setSelectedFile(null)
      onClose()
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to upload new version')
    },
  })

  const onSubmit = (data) => {
    if (!selectedFile) {
      toast.error('Please select a file to upload')
      return
    }
    uploadMutation.mutate(data)
  }

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-surface-900/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-modal w-full max-w-lg animate-scale-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100">
          <h2 className="text-lg font-semibold text-surface-900">Upload New Version</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-100 transition-colors">
            <X size={18} className="text-surface-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">
              File <span className="text-accent-red">*</span>
            </label>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.md"
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className={clsx(
                'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors',
                selectedFile
                  ? 'border-primary-300 bg-primary-50'
                  : 'border-surface-200 hover:border-primary-300 hover:bg-surface-50'
              )}
            >
              {selectedFile ? (
                <div className="flex items-center justify-center gap-3">
                  <FileText size={24} className="text-primary-600" />
                  <div className="text-left">
                    <p className="font-medium text-surface-800">{selectedFile.name}</p>
                    <p className="text-sm text-surface-500">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  <Upload className="mx-auto h-10 w-10 text-surface-400 mb-2" />
                  <p className="text-sm text-surface-600">Click to select file</p>
                  <p className="text-xs text-surface-400 mt-1">PDF, DOC, DOCX, XLS, XLSX, TXT, MD</p>
                </div>
              )}
            </div>
          </div>

          {/* Change Notes */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">
              Change Notes
            </label>
            <textarea
              {...register('changeNotes')}
              rows={3}
              className="w-full px-4 py-2.5 bg-surface-50 border border-surface-200 rounded-xl text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all resize-none"
              placeholder="Describe what changed in this version..."
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-medium text-surface-600 hover:text-surface-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploadMutation.isPending || !selectedFile}
              className="px-5 py-2.5 bg-primary-600 text-white font-medium text-sm rounded-xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              {uploadMutation.isPending ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload size={16} />
                  Upload Version
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// File content/text/markdown viewer
function FileContentViewer({ downloadUrl, fileExt }) {
  const [content, setContent] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let mounted = true

    // Reset state and start loading
    const loadContent = async () => {
      setLoading(true)
      setError(null)

      try {
        const res = await fetch(downloadUrl)
        if (!res.ok) throw new Error('Failed to fetch file')
        const text = await res.text()
        if (mounted) {
          setContent(text)
          setLoading(false)
        }
      } catch (err) {
        if (mounted) {
          setError(err.message || 'Error loading file')
          setLoading(false)
        }
      }
    }

    loadContent()

    return () => {
      mounted = false
    }
  }, [downloadUrl])

  if (loading) {
    return (
      <div className="w-full h-64 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-primary-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="w-full p-6 text-sm text-surface-500 bg-surface-50 rounded-lg">
        Failed to load preview: {error}
      </div>
    )
  }

  if (fileExt === 'md' || fileExt === 'markdown') {
    return (
      <div className="prose max-w-full">
        <ReactMarkdown>{content || ''}</ReactMarkdown>
      </div>
    )
  }

  // Plain text and other textual formats
  return (
    <div className="w-full max-h-[600px] overflow-auto bg-surface-50 rounded-lg p-4 border border-surface-200">
      <pre className="whitespace-pre-wrap text-sm text-surface-700">{content}</pre>
    </div>
  )
}

function DocumentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false)
  const [isCommentsOpen, setIsCommentsOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [zoomLevel, setZoomLevel] = useState(100)

  // Check if current user is default admin or document owner
  const isDefaultAdmin = useAuthStore((state) => state.isDefaultAdmin())
  const currentUser = useAuthStore((state) => state.user)

  // Fetch document
  const { data: document, isLoading, error } = useQuery({
    queryKey: ['document', id],
    queryFn: () => documentsAPI.get(id),
  })

  // Check if user is the document owner
  const isDocumentOwner = document && currentUser && String(document.uploaded_by) === String(currentUser.id)

  // User can delete if they are default admin or document owner
  const canDelete = isDefaultAdmin || isDocumentOwner

  // Fetch versions
  const { data: versions = [] } = useQuery({
    queryKey: ['document-versions', id],
    queryFn: () => documentsAPI.getVersions(id),
    enabled: !!document,
  })

  // Approval workflow mutations
  const submitForReviewMutation = useMutation({
    mutationFn: () => documentsAPI.submitForReview(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document', id] })
      queryClient.invalidateQueries({ queryKey: ['documents-pending-review'] })
      toast.success('Document submitted for review!')
    },
    onError: (error) => toast.error(error.response?.data?.detail || 'Failed to submit for review'),
  })

  const approveMutation = useMutation({
    mutationFn: () => documentsAPI.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document', id] })
      queryClient.invalidateQueries({ queryKey: ['documents-pending-review'] })
      toast.success('Document approved!')
    },
    onError: (error) => toast.error(error.response?.data?.detail || 'Failed to approve document'),
  })

  const rejectMutation = useMutation({
    mutationFn: () => documentsAPI.reject(id, rejectReason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document', id] })
      queryClient.invalidateQueries({ queryKey: ['documents-pending-review'] })
      toast.success('Document returned to draft.')
      setIsRejectModalOpen(false)
      setRejectReason('')
    },
    onError: (error) => toast.error(error.response?.data?.detail || 'Failed to reject document'),
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: () => documentsAPI.delete(id),
    onSuccess: () => {
      toast.success('Document deleted successfully')
      // Navigate back to project documents or previous page
      if (document?.project_id) {
        navigate(`/projects/${document.project_id}`)
      } else {
        navigate(-1)
      }
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to delete document')
    },
  })

  const handleDelete = () => {
    deleteMutation.mutate()
    setIsDeleteModalOpen(false)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} className="animate-spin text-primary-500" />
      </div>
    )
  }

  if (error || !document) {
    return (
      <div className="text-center py-12">
        <FileText size={48} className="mx-auto text-surface-300 mb-4" />
        <p className="text-surface-500 mb-4">Document not found</p>
        <button
          onClick={() => navigate(-1)}
          className="text-primary-600 hover:underline"
        >
          Go back
        </button>
      </div>
    )
  }

  const statusStyles = {
    draft: { bg: 'bg-surface-100', text: 'text-surface-600' },
    review: { bg: 'bg-amber-100', text: 'text-amber-700' },
    approved: { bg: 'bg-green-100', text: 'text-green-700' },
    published: { bg: 'bg-accent-green/10', text: 'text-accent-green' },
    archived: { bg: 'bg-surface-200', text: 'text-surface-500' },
  }

  const status = statusStyles[document.status] || statusStyles.draft

  // Approval workflow permissions
  const reviewerIds = (document.reviewers || []).map(r => String(r.id))
  const isReviewer = reviewerIds.includes(String(currentUser?.id))
  const isAdmin = currentUser?.role === 'ADMIN'
  const canSubmitForReview = isDocumentOwner && (document.status === 'draft' || document.status === 'review')
  const canApproveOrReject = (isReviewer || isAdmin) && document.status === 'review'

  return (
    <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-8 max-w-5xl">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-surface-600 hover:text-surface-900 mb-3 sm:mb-4"
        >
          <ArrowLeft size={18} className="sm:hidden" />
          <ArrowLeft size={20} className="hidden sm:inline" />
          <span className="text-sm sm:text-base">Back</span>
        </button>

        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-surface-900 mb-2 break-words">{document.title}</h1>
            {document.description && (
              <p className="text-sm sm:text-base text-surface-600 break-words">{document.description}</p>
            )}
          </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 flex-wrap">
            <span className={clsx('px-3 py-1.5 text-sm font-medium rounded-full capitalize text-center', status.bg, status.text)}>
              {document.status}
            </span>

            {/* Approval Workflow Buttons */}
            {canSubmitForReview && document.status === 'draft' && (
              <button
                onClick={() => submitForReviewMutation.mutate()}
                disabled={submitForReviewMutation.isPending}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-amber-500 text-white font-medium text-sm rounded-xl hover:bg-amber-600 disabled:opacity-50 transition-colors"
              >
                {submitForReviewMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                <span>Submit for Review</span>
              </button>
            )}
            {canApproveOrReject && (
              <>
                <button
                  onClick={() => approveMutation.mutate()}
                  disabled={approveMutation.isPending}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white font-medium text-sm rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {approveMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                  <span>Approve</span>
                </button>
                <button
                  onClick={() => setIsRejectModalOpen(true)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-100 text-red-700 font-medium text-sm rounded-xl hover:bg-red-200 transition-colors"
                >
                  <XCircle size={16} />
                  <span>Reject</span>
                </button>
              </>
            )}

            <button
              onClick={() => setIsEditModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-surface-100 text-surface-700 font-medium text-sm rounded-xl hover:bg-surface-200 transition-colors"
            >
              <Edit3 size={18} />
              <span>Edit</span>
            </button>
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white font-medium text-sm rounded-xl hover:bg-primary-700 transition-colors"
            >
              <Upload size={18} />
              <span>New Version</span>
            </button>
            <button
              onClick={() => setIsPreviewModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-white border border-surface-200 text-surface-700 font-medium text-sm rounded-xl hover:bg-surface-50 transition-colors"
            >
              <Eye size={16} />
              <span>Preview</span>
            </button>
            {canDelete && (
              <button
                onClick={() => setIsDeleteModalOpen(true)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white font-medium text-sm rounded-xl hover:bg-red-700 transition-colors"
              >
                <Trash2 size={18} />
                <span>Delete</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* File Preview Section - Top Priority */}
      <div className="bg-white rounded-2xl border border-surface-200 overflow-hidden mb-4 sm:mb-6">
        <div className="border-b border-surface-100 p-3 sm:p-4 bg-surface-50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <FileText size={18} className="text-surface-600 flex-shrink-0 sm:hidden" />
              <FileText size={20} className="text-surface-600 flex-shrink-0 hidden sm:inline" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm sm:text-base text-surface-900 truncate">{document.file_name}</p>
                <p className="text-xs sm:text-sm text-surface-500 flex flex-wrap items-center gap-1">
                  <span>{document.file_size ? `${(document.file_size / 1024 / 1024).toFixed(2)} MB` : 'N/A'}</span>
                  <span className="hidden sm:inline">•</span>
                  <span>v{document.version}</span>
                  <span className="hidden sm:inline">•</span>
                  <span className="hidden sm:inline">Uploaded {formatDistanceToNow(new Date(document.uploaded_at), { addSuffix: true })}</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={documentsAPI.download(document.id)}
                download
                className="inline-flex items-center justify-center gap-2 px-3 py-2 bg-surface-100 text-surface-700 font-medium text-sm rounded-lg hover:bg-surface-200 transition-colors flex-1 sm:flex-initial"
              >
                <Download size={14} className="sm:hidden" />
                <Download size={16} className="hidden sm:inline" />
                <span>Download</span>
              </a>
            </div>
          </div>
        </div>

        {/* Document Preview */}
        <div className="p-4 sm:p-6">
          {/* Zoom Controls */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 mb-4 bg-surface-50 p-3 rounded-lg">
            <span className="text-xs sm:text-sm font-medium text-surface-700">Preview Zoom</span>
            <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto justify-between sm:justify-start">
              <button
                onClick={() => setZoomLevel(prev => Math.max(50, prev - 10))}
                className="p-1.5 rounded hover:bg-white border border-surface-200 text-surface-600"
                title="Zoom out"
                aria-label="Zoom out"
              >
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
              </button>
              <span className="text-xs sm:text-sm font-medium text-surface-900 w-12 sm:w-16 text-center">{zoomLevel}%</span>
              <button
                onClick={() => setZoomLevel(prev => Math.min(200, prev + 10))}
                className="p-1.5 rounded hover:bg-white border border-surface-200 text-surface-600"
                title="Zoom in"
                aria-label="Zoom in"
              >
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
              <button
                onClick={() => setZoomLevel(100)}
                className="px-2 py-1 text-xs rounded hover:bg-white border border-surface-200 text-surface-600"
                title="Reset zoom"
              >
                Reset
              </button>
            </div>
          </div>

          {(() => {
            const fileExt = document.file_name?.split('.').pop()?.toLowerCase()
            // Use client helper so we don't accidentally duplicate /api/v1
            const downloadUrl = documentsAPI.download(document.id)

            // PDF Preview
            if (fileExt === 'pdf') {
              return (
                <div className="w-full h-[500px] sm:h-[600px] border border-surface-200 rounded-lg overflow-auto bg-surface-50">
                  <div style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top left', width: `${10000 / zoomLevel}%` }}>
                    <iframe
                      src={downloadUrl}
                      className="w-full h-[500px] sm:h-[600px]"
                      title="PDF Preview"
                    />
                  </div>
                </div>
              )
            }

            // DOCX/DOC Preview using Google Docs Viewer
            if (['docx', 'doc'].includes(fileExt)) {
              return (
                <div className="w-full h-[500px] sm:h-[600px] border border-surface-200 rounded-lg bg-surface-50 flex flex-col items-center justify-center p-6">
                  <FileText size={64} className="text-surface-300 mb-4" />
                  <h3 className="text-lg font-semibold text-surface-700 mb-2">Word Document Preview</h3>
                  <p className="text-sm text-surface-500 text-center mb-6 max-w-md">
                    Preview is not available for Word documents. Please download the file to view it.
                  </p>
                  <div className="flex gap-3">
                    <a
                      href={downloadUrl}
                      download
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white font-medium text-sm rounded-xl hover:bg-primary-700 transition-colors"
                    >
                      <Download size={16} />
                      Download Document
                    </a>
                  </div>
                  <div className="mt-6 text-xs text-surface-400">
                    <p className="font-medium mb-1">File Details:</p>
                    <p>Name: {document.file_name}</p>
                    <p>Size: {document.file_size ? `${(document.file_size / 1024 / 1024).toFixed(2)} MB` : 'N/A'}</p>
                    <p>Version: {document.version}</p>
                  </div>
                </div>
              )
            }

            // Image Preview
            if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(fileExt)) {
              return (
                <div className="w-full max-h-[600px] border border-surface-200 rounded-lg overflow-auto bg-surface-50 flex items-center justify-center p-4">
                  <img
                    src={downloadUrl}
                    alt={document.title}
                    style={{ transform: `scale(${zoomLevel / 100})` }}
                    className="max-w-full max-h-[560px] object-contain transition-transform"
                  />
                </div>
              )
            }

            // Text / Markdown Preview
            if (['md', 'markdown', 'txt', 'csv', 'log', 'ini', 'json', 'yaml', 'yml'].includes(fileExt)) {
              return (
                <div className="w-full border border-surface-200 rounded-lg overflow-hidden bg-white p-4">
                  <FileContentViewer downloadUrl={downloadUrl} fileExt={fileExt} />
                </div>
              )
            }

            // No preview available
            return (
              <div className="w-full h-[400px] border border-surface-200 rounded-lg bg-surface-50 flex flex-col items-center justify-center p-6 text-center">
                <FileText size={64} className="text-surface-300 mb-4" />
                <h3 className="text-lg font-semibold text-surface-700 mb-2">Preview Not Available</h3>
                <p className="text-sm text-surface-500 mb-4">{document.file_name}</p>
                <a href={downloadUrl} download className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700">
                  <Download size={18} />
                  Download File
                </a>
              </div>
            )
          })()}
          <p className="text-xs text-surface-500 mt-2">
            ℹ️ Preview supports PDFs, Word documents (DOCX/DOC), images, and text files. Use zoom controls above to adjust preview size.
          </p>
        </div>
      </div>

      {/* Comments Section - Below Preview */}
      <div className="mb-6">
        <CommentsSection documentId={id} />
      </div>

      {/* Preview + Comments modal (mini interface) */}
      {isPreviewModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="preview-title"
          onKeyDown={(e) => {
            if (e.key === 'Escape') setIsPreviewModalOpen(false)
          }}
        >
          <div className="absolute inset-0 bg-surface-900/60 backdrop-blur-sm" onClick={() => setIsPreviewModalOpen(false)} />

          <div className="relative w-full max-w-6xl h-[90vh] sm:h-[85vh] bg-white rounded-lg sm:rounded-2xl shadow-modal overflow-hidden animate-scale-in flex flex-col" tabIndex={-1}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-surface-100 gap-2">
              <h3 id="preview-title" className="font-semibold text-sm sm:text-base truncate max-w-full sm:max-w-md">Preview — {document.title}</h3>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                {/* Zoom Controls in Modal */}
                <div className="flex items-center gap-1 sm:gap-1.5">
                  <button
                    onClick={() => setZoomLevel(prev => Math.max(50, prev - 10))}
                    className="p-1 sm:p-1.5 rounded hover:bg-surface-100 border border-surface-200 text-surface-600"
                    title="Zoom out"
                    aria-label="Zoom out"
                  >
                    <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                    </svg>
                  </button>
                  <span className="text-xs font-medium text-surface-900 w-10 sm:w-12 text-center">{zoomLevel}%</span>
                  <button
                    onClick={() => setZoomLevel(prev => Math.min(200, prev + 10))}
                    className="p-1 sm:p-1.5 rounded hover:bg-surface-100 border border-surface-200 text-surface-600"
                    title="Zoom in"
                    aria-label="Zoom in"
                  >
                    <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setZoomLevel(100)}
                    className="px-1.5 sm:px-2 py-1 text-xs rounded hover:bg-surface-100 border border-surface-200 text-surface-600"
                    title="Reset zoom"
                  >
                    100%
                  </button>
                </div>
                <button
                  onClick={() => setIsPreviewModalOpen(false)}
                  className="px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm border border-transparent hover:bg-surface-50"
                  aria-label="Close preview dialog"
                  ref={(el) => {
                    if (isPreviewModalOpen && el) el.focus()
                  }}
                >
                  Close
                </button>
              </div>
            </div>

            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-auto p-2 sm:p-4 bg-surface-50">
                {/* Use existing preview rendering for the modal */}
                <div className="h-full w-full flex items-center justify-center overflow-auto">
                  {(() => {
                    const fileExt = document.file_name?.split('.').pop()?.toLowerCase()
                    const downloadUrl = documentsAPI.download(document.id)

                    if (fileExt === 'pdf') {
                      return (
                        <div className="w-full h-full overflow-auto">
                          <div style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top left', width: `${10000 / zoomLevel}%` }}>
                            <iframe src={downloadUrl} title="PDF Preview" className="w-full h-full min-h-[600px] border rounded-lg" />
                          </div>
                        </div>
                      )
                    }

                    if (['docx', 'doc'].includes(fileExt)) {
                      return (
                        <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-surface-50">
                          <FileText size={56} className="text-surface-300 mb-4" />
                          <h3 className="text-base font-semibold text-surface-700 mb-2">Word Document Preview</h3>
                          <p className="text-sm text-surface-500 text-center mb-4 max-w-md">
                            Preview is not available for Word documents. Please download the file to view it.
                          </p>
                          <a
                            href={downloadUrl}
                            download
                            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white font-medium text-sm rounded-lg hover:bg-primary-700 transition-colors"
                          >
                            <Download size={16} />
                            Download Document
                          </a>
                          <div className="mt-4 text-xs text-surface-400 text-center">
                            <p>Name: {document.file_name}</p>
                            <p>Size: {document.file_size ? `${(document.file_size / 1024 / 1024).toFixed(2)} MB` : 'N/A'}</p>
                          </div>
                        </div>
                      )
                    }

                    if (['jpg','jpeg','png','gif','webp','svg'].includes(fileExt)) {
                      return (
                        <img
                          src={downloadUrl}
                          alt={document.title}
                          style={{ transform: `scale(${zoomLevel / 100})` }}
                          className="max-w-full max-h-full object-contain transition-transform"
                        />
                      )
                    }

                    if (['md', 'markdown', 'txt','csv','log','ini','json','yaml','yml'].includes(fileExt)) {
                      return (
                        <div className="w-full h-full overflow-auto" style={{ fontSize: `${zoomLevel}%` }}>
                          <FileContentViewer downloadUrl={downloadUrl} fileExt={fileExt} />
                        </div>
                      )
                    }

                    return (
                      <div className="text-center text-surface-500">
                        <FileText size={48} className="mx-auto mb-4" />
                        <div>Preview not available for this file type.</div>
                      </div>
                    )
                  })()}
                </div>
              </div>

              {/* Comments section - Collapsible, minimal size on desktop */}
              <div className="hidden lg:block border-t border-surface-100">
                <button
                  onClick={() => setIsCommentsOpen((s) => !s)}
                  className="w-full flex items-center justify-between p-3 bg-surface-50 hover:bg-surface-100 transition-colors"
                  aria-pressed={isCommentsOpen}
                  aria-label={isCommentsOpen ? 'Collapse comments' : 'Expand comments'}
                >
                  <h4 className="text-sm font-semibold">Comments</h4>
                  <svg
                    className={`w-4 h-4 transition-transform ${isCommentsOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {isCommentsOpen && (
                  <div className="overflow-auto p-3 max-h-[200px] bg-white">
                    <CommentsSection documentId={id} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Document Information & Tags */}
      <div className="bg-white rounded-2xl border border-surface-200 p-6 mb-6">
        <h3 className="text-lg font-semibold text-surface-900 mb-4">Document Information</h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
          <div>
            <p className="text-sm text-surface-500 mb-1">Current Version</p>
            <p className="font-semibold text-surface-900">v{document.version}</p>
          </div>
          <div>
            <p className="text-sm text-surface-500 mb-1">File Name</p>
            <p className="font-semibold text-surface-900 truncate">{document.file_name}</p>
          </div>
          <div>
            <p className="text-sm text-surface-500 mb-1">File Size</p>
            <p className="font-semibold text-surface-900">
              {document.file_size ? `${(document.file_size / 1024 / 1024).toFixed(2)} MB` : 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-sm text-surface-500 mb-1">Uploaded</p>
            <p className="font-semibold text-surface-900">
              {formatDistanceToNow(new Date(document.uploaded_at), { addSuffix: true })}
            </p>
          </div>
        </div>

        {/* Reviewers */}
        {document.reviewers && document.reviewers.length > 0 && (
          <div className="border-t border-surface-100 pt-4 mb-4">
            <p className="text-sm text-surface-500 mb-2 flex items-center gap-1.5">
              <User size={14} /> Assigned Reviewers
            </p>
            <div className="flex flex-wrap gap-2">
              {document.reviewers.map((reviewer) => (
                <span
                  key={reviewer.id}
                  className={clsx(
                    'px-3 py-1 text-xs font-medium rounded-full border',
                    reviewerIds.includes(String(currentUser?.id)) && String(reviewer.id) === String(currentUser?.id)
                      ? 'bg-amber-50 border-amber-200 text-amber-700'
                      : 'bg-surface-50 border-surface-200 text-surface-600'
                  )}
                >
                  {reviewer.full_name || reviewer.email}
                  {String(reviewer.id) === String(currentUser?.id) && ' (you)'}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Tags */}
        <div className="border-t border-surface-100 pt-4">
          <TagsSection documentId={id} />
        </div>
      </div>

      {/* Version History */}
      <div className="bg-white rounded-2xl border border-surface-200 p-6">
        <div className="flex items-center gap-2 mb-6">
          <History size={20} className="text-surface-600" />
          <h2 className="text-lg font-semibold text-surface-900">Version History</h2>
          <span className="text-sm text-surface-500">({versions.length} versions)</span>
        </div>

        {versions.length === 0 ? (
          <div className="text-center py-12">
            <History size={48} className="mx-auto text-surface-300 mb-4" />
            <p className="text-surface-500">No version history available</p>
          </div>
        ) : (
          <div className="space-y-4">
            {versions.map((version, index) => (
              <div
                key={version.id}
                className={clsx(
                  'flex items-start gap-4 p-4 rounded-xl border transition-all',
                  index === 0
                    ? 'border-primary-300 bg-primary-50'
                    : 'border-surface-200 hover:border-surface-300'
                )}
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-semibold flex-shrink-0">
                  v{version.version_number}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-surface-900">
                      Version {version.version_number}
                      {index === 0 && (
                        <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-primary-600 text-white rounded-full">
                          Current
                        </span>
                      )}
                    </p>
                  </div>

                  {version.change_notes && (
                    <p className="text-sm text-surface-600 mb-2">{version.change_notes}</p>
                  )}

                  <div className="flex items-center gap-4 text-sm text-surface-500">
                    <div className="flex items-center gap-1">
                      <Clock size={14} />
                      {format(new Date(version.created_at), 'MMM d, yyyy h:mm a')}
                    </div>
                    <div className="flex items-center gap-1">
                      <FileText size={14} />
                      {version.file_size ? `${(version.file_size / 1024 / 1024).toFixed(2)} MB` : 'N/A'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={documentsAPI.download(id, version.version_number)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg hover:bg-white transition-colors flex-shrink-0"
                    title="Preview this version"
                  >
                    <Eye size={18} className="text-surface-600" />
                  </a>
                  <a
                    href={documentsAPI.download(id, version.version_number)}
                    download
                    className="p-2 rounded-lg hover:bg-white transition-colors flex-shrink-0"
                    title="Download this version"
                  >
                    <Download size={18} className="text-surface-600" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-surface-900/60 backdrop-blur-sm" onClick={() => setIsRejectModalOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-modal w-full max-w-md animate-scale-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100">
              <h2 className="text-lg font-semibold text-surface-900">Reject Document</h2>
              <button onClick={() => setIsRejectModalOpen(false)} className="p-1.5 rounded-lg hover:bg-surface-100">
                <X size={18} className="text-surface-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-surface-600">
                The document will be returned to <strong>draft</strong> status and the author will be notified.
              </p>
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1.5">Reason (optional)</label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  placeholder="Explain what needs to be changed..."
                  className="w-full px-4 py-2.5 bg-surface-50 border border-surface-200 rounded-xl text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400 transition-all resize-none"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRejectModalOpen(false)}
                  className="px-5 py-2.5 text-sm font-medium text-surface-600 hover:text-surface-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => rejectMutation.mutate()}
                  disabled={rejectMutation.isPending}
                  className="px-5 py-2.5 bg-red-600 text-white font-medium text-sm rounded-xl hover:bg-red-700 disabled:opacity-50 transition-all flex items-center gap-2"
                >
                  {rejectMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
                  Reject Document
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      <UploadVersionModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        documentId={id}
      />

      {/* Edit Metadata Modal */}
      <EditDocumentModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        document={document}
      />

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-surface-900/60 backdrop-blur-sm" onClick={() => setIsDeleteModalOpen(false)} />

          <div className="relative bg-white rounded-2xl shadow-modal w-full max-w-md animate-scale-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100">
              <h2 className="text-lg font-semibold text-surface-900">Delete Document</h2>
              <button onClick={() => setIsDeleteModalOpen(false)} className="p-1.5 rounded-lg hover:bg-surface-100 transition-colors">
                <X size={18} className="text-surface-500" />
              </button>
            </div>

            <div className="p-6">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <Trash2 size={24} className="text-red-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-surface-900 mb-2">Are you sure?</h3>
                  <p className="text-sm text-surface-600 mb-2">
                    This will permanently delete <span className="font-semibold">{document?.title}</span> and all of its versions.
                  </p>
                  <p className="text-sm text-surface-600">
                    This action cannot be undone.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(false)}
                  disabled={deleteMutation.isPending}
                  className="px-5 py-2.5 text-sm font-medium text-surface-600 hover:text-surface-800 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                  className="px-5 py-2.5 bg-red-600 text-white font-medium text-sm rounded-xl hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                >
                  {deleteMutation.isPending ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} />
                      Delete Document
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DocumentDetail
