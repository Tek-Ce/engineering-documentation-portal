import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { FileText, Eye, FolderKanban, Clock, Loader2 } from 'lucide-react'
import { documentsAPI } from '../api/client'
import { formatDistanceToNow } from 'date-fns'

export default function ReviewQueue() {
  const { data: documents = [], isLoading, error } = useQuery({
    queryKey: ['documents-pending-review'],
    queryFn: () => documentsAPI.pendingReview(),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 size={32} className="animate-spin text-primary-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-700">Failed to load review queue. Please try again.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-surface-900 flex items-center gap-2">
          <Eye size={28} className="text-amber-500" />
          Review Queue
        </h1>
        <p className="text-surface-500 mt-1">
          Documents waiting for your review. Open a document to approve or reject.
        </p>
      </div>

      {documents.length === 0 ? (
        <div className="bg-white rounded-2xl border border-surface-200 p-12 text-center">
          <Eye size={48} className="mx-auto text-surface-300 mb-4" />
          <h2 className="text-lg font-semibold text-surface-700 mb-2">No documents to review</h2>
          <p className="text-surface-500 text-sm max-w-md mx-auto">
            When someone submits a document for review and you are assigned as a reviewer, it will appear here.
          </p>
          <Link
            to="/projects"
            className="inline-flex items-center gap-2 mt-6 px-4 py-2 bg-primary-600 text-white font-medium rounded-xl hover:bg-primary-700 transition-colors"
          >
            <FolderKanban size={18} />
            Go to Projects
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {documents.map((doc) => (
            <li key={doc.id}>
              <Link
                to={`/documents/${doc.id}`}
                className="block bg-white rounded-xl border border-surface-200 p-4 sm:p-5 hover:shadow-hover hover:border-surface-300 transition-all group"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <FileText size={20} className="text-amber-600 sm:w-6 sm:h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-surface-900 group-hover:text-primary-600 transition-colors truncate">
                      {doc.title}
                    </h3>
                    <p className="text-sm text-surface-500 mt-0.5 truncate">{doc.file_name}</p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-surface-400">
                      <span className="flex items-center gap-1">
                        <FolderKanban size={12} />
                        {doc.project_name || 'Project'}
                      </span>
                      <span>v{doc.version}</span>
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {doc.updated_at && formatDistanceToNow(new Date(doc.updated_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                  <span className="flex items-center gap-1.5 text-sm font-medium text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg flex-shrink-0">
                    <Eye size={16} />
                    Review
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
