import { useState, useEffect } from 'react'
import {
  FileText,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Play,
  RefreshCw,
  Upload,
  X
} from 'lucide-react'
import { kbAPI } from '../../api/kb'
import { documentsAPI } from '../../api/client'

export default function DocumentIndexer({ projectId }) {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(false)
  const [indexingDocs, setIndexingDocs] = useState(new Set())
  const [uploading, setUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)

  useEffect(() => {
    if (projectId) {
      loadDocuments()
    }
  }, [projectId])

  const loadDocuments = async () => {
    setLoading(true)
    try {
      const response = await documentsAPI.list({ project_id: projectId })
      setDocuments(response.documents || [])
    } catch (err) {
      console.error('Failed to load documents:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
    }
  }

  const handleUploadDocument = async () => {
    if (!selectedFile || !projectId) return

    setUploading(true)
    try {
      await documentsAPI.upload(
        projectId,
        selectedFile.name,
        `Uploaded for Knowledge Base indexing`,
        'draft',
        selectedFile,
        'other',
        [],
        []
      )

      setSelectedFile(null)
      // Reset file input
      const fileInput = document.getElementById('file-upload-input')
      if (fileInput) fileInput.value = ''

      // Reload documents
      await loadDocuments()
    } catch (err) {
      alert(`Upload failed: ${err.message}`)
    } finally {
      setUploading(false)
    }
  }

  const handleIndexDocument = async (documentId) => {
    setIndexingDocs(prev => new Set(prev).add(documentId))

    try {
      const response = await kbAPI.indexDocument(documentId)

      // Poll for job status
      await pollJobStatus(response.job_id, documentId)

      // Reload documents to update status
      await loadDocuments()
    } catch (err) {
      alert(`Indexing failed: ${err.message}`)
    } finally {
      setIndexingDocs(prev => {
        const newSet = new Set(prev)
        newSet.delete(documentId)
        return newSet
      })
    }
  }

  const pollJobStatus = async (jobId, documentId, maxAttempts = 60) => {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000)) // Wait 2s

      try {
        const status = await kbAPI.getJobStatus(jobId)

        if (status.status === 'completed') {
          return
        } else if (status.status === 'failed') {
          throw new Error(status.error_message || 'Indexing failed')
        }
      } catch (err) {
        console.error('Failed to check status:', err)
        break
      }
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'indexed':
        return <CheckCircle2 className="text-green-600" size={20} />
      case 'indexing':
        return <Loader2 className="text-blue-600 animate-spin" size={20} />
      case 'failed':
        return <XCircle className="text-red-600" size={20} />
      default:
        return <Clock className="text-gray-400" size={20} />
    }
  }

  const getStatusText = (status, chunks) => {
    switch (status) {
      case 'indexed':
        return `Indexed (${chunks || 0} chunks)`
      case 'indexing':
        return 'Indexing...'
      case 'failed':
        return 'Failed'
      default:
        return 'Not indexed'
    }
  }

  if (!projectId) {
    return (
      <div className="text-center py-12 text-gray-500">
        <FileText className="mx-auto mb-3 text-gray-300" size={48} />
        <p>Select a project to view documents</p>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold">Project Documents</h3>
          <p className="text-sm text-gray-500 mt-1">
            Upload and index documents to enable semantic search
          </p>
        </div>
        <button
          onClick={loadDocuments}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={loading ? 'animate-spin' : ''} size={16} />
          Refresh
        </button>
      </div>

      {/* Upload Section */}
      {projectId && (
        <div className="mb-6 p-4 bg-blue-50 border-2 border-dashed border-blue-300 rounded-lg">
          <div className="flex items-start gap-4">
            <Upload className="text-blue-600 flex-shrink-0 mt-1" size={24} />
            <div className="flex-1">
              <h4 className="font-medium text-blue-900 mb-2">Upload Document</h4>

              {selectedFile ? (
                <div className="bg-white rounded-lg p-3 border border-blue-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="text-blue-600" size={20} />
                      <div>
                        <p className="font-medium text-gray-900">{selectedFile.name}</p>
                        <p className="text-xs text-gray-500">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedFile(null)}
                      className="p-1 text-gray-400 hover:text-red-600 rounded"
                    >
                      <X size={20} />
                    </button>
                  </div>
                  <button
                    onClick={handleUploadDocument}
                    disabled={uploading}
                    className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="animate-spin" size={16} />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload size={16} />
                        Upload Document
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div>
                  <input
                    id="file-upload-input"
                    type="file"
                    onChange={handleFileSelect}
                    accept=".pdf,.doc,.docx,.txt,.md"
                    className="hidden"
                  />
                  <label
                    htmlFor="file-upload-input"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 cursor-pointer"
                  >
                    <FileText size={16} />
                    Choose File
                  </label>
                  <p className="text-xs text-blue-700 mt-2">
                    Supported formats: PDF, DOC, DOCX, TXT, MD
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Documents List */}
      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="mx-auto text-gray-400 animate-spin mb-3" size={32} />
          <p className="text-gray-500">Loading documents...</p>
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <FileText className="mx-auto mb-3 text-gray-300" size={48} />
          <p className="text-gray-500">No documents found</p>
          <p className="text-sm text-gray-400 mt-1">Upload documents to this project first</p>
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => {
            const isIndexing = indexingDocs.has(doc.id)
            // Determine status: check if document has been indexed in KB
            const currentStatus = isIndexing ? 'indexing' : (doc.kb_indexed ? 'indexed' : 'not_indexed')

            return (
              <div
                key={doc.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                {/* Document Info */}
                <div className="flex items-center gap-4 flex-1">
                  <FileText className="text-gray-400 flex-shrink-0" size={24} />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 truncate">{doc.title}</h4>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      <span>{(doc.file_size / 1024).toFixed(0)} KB</span>
                      <span>•</span>
                      <span>Uploaded {new Date(doc.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                {/* Status */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(currentStatus)}
                    <span className="text-sm text-gray-600">
                      {getStatusText(currentStatus, doc.chunks)}
                    </span>
                  </div>

                  {/* Action Button */}
                  {currentStatus === 'not_indexed' && (
                    <button
                      onClick={() => handleIndexDocument(doc.id)}
                      disabled={isIndexing}
                      className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      <Play size={14} />
                      Index
                    </button>
                  )}

                  {currentStatus === 'failed' && (
                    <button
                      onClick={() => handleIndexDocument(doc.id)}
                      disabled={isIndexing}
                      className="flex items-center gap-2 px-4 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
                    >
                      <RefreshCw size={14} />
                      Retry
                    </button>
                  )}

                  {currentStatus === 'indexed' && (
                    <button
                      onClick={() => handleIndexDocument(doc.id)}
                      disabled={isIndexing}
                      className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                    >
                      <RefreshCw size={14} />
                      Re-index
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Info Box */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="text-sm font-medium text-blue-900 mb-2">About Indexing</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Documents are split into chunks and embedded for semantic search</li>
          <li>• Indexing may take 1-2 minutes per document depending on size</li>
          <li>• Re-indexing updates the embeddings if document content changed</li>
        </ul>
      </div>
    </div>
  )
}
