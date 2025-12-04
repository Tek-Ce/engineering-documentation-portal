import { useState, useEffect } from 'react'
import {
  BarChart3,
  FileText,
  Database,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  TrendingUp
} from 'lucide-react'
import { kbAPI } from '../../api/kb'

export default function KBStatus({ projectId }) {
  const [stats, setStats] = useState(null)
  const [recentJobs, setRecentJobs] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (projectId) {
      loadStats()
    }
  }, [projectId])

  const loadStats = async () => {
    setLoading(true)
    try {
      // TODO: Implement stats endpoint
      // Mock data for now
      setStats({
        total_documents: 156,
        indexed_documents: 142,
        total_chunks: 5847,
        total_searches: 1243,
        avg_search_time_ms: 45
      })

      setRecentJobs([
        {
          id: '1',
          document_title: 'Requirements.pdf',
          status: 'completed',
          chunks_created: 45,
          started_at: '2025-12-03 14:25:00',
          completed_at: '2025-12-03 14:26:30'
        },
        {
          id: '2',
          document_title: 'Architecture.docx',
          status: 'processing',
          progress: 65,
          started_at: '2025-12-03 14:30:00'
        },
        {
          id: '3',
          document_title: 'Meeting Notes.txt',
          status: 'failed',
          error_message: 'File not found',
          started_at: '2025-12-03 13:45:00'
        }
      ])
    } catch (err) {
      console.error('Failed to load stats:', err)
    } finally {
      setLoading(false)
    }
  }

  const getJobStatusBadge = (status) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
            <CheckCircle2 size={12} />
            Completed
          </span>
        )
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
            <Loader2 size={12} className="animate-spin" />
            Processing
          </span>
        )
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded">
            <XCircle size={12} />
            Failed
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-800 text-xs font-medium rounded">
            <Clock size={12} />
            Queued
          </span>
        )
    }
  }

  if (!projectId) {
    return (
      <div className="text-center py-12 text-gray-500">
        <BarChart3 className="mx-auto mb-3 text-gray-300" size={48} />
        <p>Select a project to view statistics</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <Loader2 className="mx-auto text-gray-400 animate-spin mb-3" size={32} />
        <p className="text-gray-500">Loading statistics...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Documents */}
          <div className="bg-white p-6 border border-gray-200 rounded-lg">
            <div className="flex items-center justify-between mb-4">
              <FileText className="text-blue-600" size={24} />
              <TrendingUp className="text-green-600" size={16} />
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.indexed_documents}</div>
            <div className="text-sm text-gray-500 mt-1">
              Indexed Documents ({stats.total_documents} total)
            </div>
            <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full"
                style={{
                  width: `${(stats.indexed_documents / stats.total_documents) * 100}%`
                }}
              />
            </div>
          </div>

          {/* Chunks */}
          <div className="bg-white p-6 border border-gray-200 rounded-lg">
            <div className="flex items-center justify-between mb-4">
              <Database className="text-purple-600" size={24} />
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {stats.total_chunks.toLocaleString()}
            </div>
            <div className="text-sm text-gray-500 mt-1">Total Chunks</div>
            <div className="text-xs text-gray-400 mt-2">
              ~{Math.round(stats.total_chunks / stats.indexed_documents)} per document
            </div>
          </div>

          {/* Searches */}
          <div className="bg-white p-6 border border-gray-200 rounded-lg">
            <div className="flex items-center justify-between mb-4">
              <BarChart3 className="text-green-600" size={24} />
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {stats.total_searches.toLocaleString()}
            </div>
            <div className="text-sm text-gray-500 mt-1">Total Searches</div>
            <div className="text-xs text-gray-400 mt-2">
              Avg {stats.avg_search_time_ms}ms response time
            </div>
          </div>
        </div>
      )}

      {/* Recent Jobs */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold">Recent Indexing Jobs</h3>
        </div>

        <div className="divide-y divide-gray-200">
          {recentJobs.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              <Clock className="mx-auto mb-2 text-gray-300" size={32} />
              <p>No indexing jobs yet</p>
            </div>
          ) : (
            recentJobs.map((job) => (
              <div key={job.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-medium text-gray-900">{job.document_title}</h4>
                      {getJobStatusBadge(job.status)}
                    </div>

                    <div className="text-xs text-gray-500 space-y-1">
                      <div>Started: {job.started_at}</div>
                      {job.completed_at && <div>Completed: {job.completed_at}</div>}
                      {job.chunks_created && (
                        <div className="text-green-600 font-medium">
                          {job.chunks_created} chunks created
                        </div>
                      )}
                      {job.error_message && (
                        <div className="text-red-600 font-medium">
                          Error: {job.error_message}
                        </div>
                      )}
                    </div>

                    {/* Progress Bar */}
                    {job.status === 'processing' && job.progress !== undefined && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                          <span>Processing...</span>
                          <span>{job.progress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div
                            className="bg-blue-600 h-1.5 rounded-full transition-all"
                            style={{ width: `${job.progress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
