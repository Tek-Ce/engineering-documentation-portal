import { useState, useEffect } from 'react'
import {
  Search,
  FileText,
  Upload,
  Database,
  Loader2,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  FileSearch
} from 'lucide-react'
import { kbAPI } from '../../api/kb'
import { projectsAPI } from '../../api/client'
import { useAuthStore } from '../../store/authStore'
import DocumentIndexer from './DocumentIndexer'
import KBStatus from './KBStatus'

export default function KnowledgeBase() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'ADMIN'

  const [activeTab, setActiveTab] = useState('search') // search, index, status
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedProject, setSelectedProject] = useState('') // empty string = all projects
  const [projects, setProjects] = useState([])
  const [documents, setDocuments] = useState([])
  const [indexingJobs, setIndexingJobs] = useState([])
  const [kbHealth, setKbHealth] = useState(null)
  const [error, setError] = useState(null)
  const [isLoadingProjects, setIsLoadingProjects] = useState(false)

  // Load KB health and projects on mount
  useEffect(() => {
    loadKBHealth()
    loadProjects()
  }, [])

  const loadKBHealth = async () => {
    try {
      const health = await kbAPI.healthCheck()
      setKbHealth(health)
    } catch (err) {
      console.error('Health check failed:', err)
    }
  }

  const loadProjects = async () => {
    setIsLoadingProjects(true)
    try {
      const response = await projectsAPI.list()
      setProjects(response.projects || [])
    } catch (err) {
      console.error('Failed to load projects:', err)
    } finally {
      setIsLoadingProjects(false)
    }
  }

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!searchQuery.trim()) return

    setIsSearching(true)
    setError(null)

    try {
      const response = await kbAPI.search({
        query: searchQuery.trim(),
        project_id: selectedProject || null, // null = search all projects
        top_k: 10,
        min_similarity: 0.3,
        use_hybrid: true
      })
      setSearchResults(response.results || [])
    } catch (err) {
      setError(err.message || 'Search failed')
    } finally {
      setIsSearching(false)
    }
  }

  // Helper function to highlight keywords in text
  const highlightText = (text, keywords) => {
    if (!keywords || keywords.length === 0) return text

    let highlightedText = text
    keywords.forEach(keyword => {
      const regex = new RegExp(`(${keyword})`, 'gi')
      highlightedText = highlightedText.replace(regex, '<mark class="bg-yellow-200">$1</mark>')
    })
    return highlightedText
  }

  const handleIndexDocument = async (documentId) => {
    try {
      const response = await kbAPI.indexDocument(documentId)
      alert(`Indexing started! Job ID: ${response.job_id}`)
      loadIndexingJobs()
    } catch (err) {
      alert(`Indexing failed: ${err.message}`)
    }
  }

  const loadIndexingJobs = async () => {
    // TODO: Implement job listing endpoint
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Database className="text-blue-600" size={32} />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Knowledge Base</h1>
                <p className="text-sm text-gray-500">Semantic search across all documentation</p>
              </div>
            </div>

            {/* Health Status */}
            {kbHealth && (
              <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-lg">
                <CheckCircle2 className="text-green-600" size={16} />
                <span className="text-sm text-green-700">
                  Service Healthy ({kbHealth.embedding_dim}D embeddings)
                </span>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-6 mt-6">
            <button
              onClick={() => setActiveTab('search')}
              className={`pb-3 px-1 flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === 'search'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Search size={18} />
              <span className="font-medium">Search</span>
            </button>

            <button
              onClick={() => setActiveTab('index')}
              className={`pb-3 px-1 flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === 'index'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Upload size={18} />
              <span className="font-medium">Index Documents</span>
            </button>

            {isAdmin && (
              <button
                onClick={() => setActiveTab('status')}
                className={`pb-3 px-1 flex items-center gap-2 border-b-2 transition-colors ${
                  activeTab === 'status'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <BarChart3 size={18} />
                <span className="font-medium">Status</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Search Tab */}
        {activeTab === 'search' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-6">Semantic Search</h2>

            {/* Project Selector */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Project (or search all)
              </label>
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                disabled={isLoadingProjects}
              >
                <option value="">
                  {isLoadingProjects ? 'Loading projects...' : 'All Projects'}
                </option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
              {projects.length === 0 && !isLoadingProjects && (
                <p className="mt-2 text-sm text-gray-500">
                  No projects available. Create a project first.
                </p>
              )}
            </div>

            {/* Search Form */}
            <form onSubmit={handleSearch} className="mb-6">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search documentation across all projects..."
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  disabled={isSearching}
                />
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                {isSearching && (
                  <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-500 animate-spin" size={20} />
                )}
              </div>
              {selectedProject === '' && (
                <p className="mt-2 text-xs text-blue-600">
                  💡 Searching across all projects
                </p>
              )}
            </form>

            {/* Error */}
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <AlertCircle className="text-red-500 mt-0.5" size={20} />
                <div className="text-sm text-red-700">{error}</div>
              </div>
            )}

            {/* Results */}
            {searchResults.length > 0 && (
              <div>
                <div className="text-sm text-gray-600 mb-4">
                  Found {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                </div>
                <div className="space-y-4">
                  {searchResults.map((result) => {
                    // Find project name
                    const project = projects.find(p => p.id === result.project_id)

                    return (
                      <div
                        key={result.chunk_id}
                        className="p-5 border border-gray-200 rounded-lg hover:shadow-lg transition-all"
                      >
                        {/* Header with breadcrumb */}
                        <div className="flex items-center justify-between mb-3 pb-2 border-b">
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <Database size={14} className="text-gray-400" />
                            <span className="font-medium">{project?.name || 'Unknown Project'}</span>
                            <span>→</span>
                            <FileText size={14} className="text-gray-400" />
                            <span>{result.metadata?.file_name || 'Document'}</span>
                          </div>
                          <span className="text-xs font-semibold px-2 py-1 bg-blue-100 text-blue-700 rounded">
                            {Math.round(result.similarity_score * 100)}% match
                          </span>
                        </div>

                        {/* Content with highlighting */}
                        <div
                          className="text-sm text-gray-700 leading-relaxed"
                          dangerouslySetInnerHTML={{
                            __html: highlightText(result.chunk_text, result.keywords || [])
                          }}
                        />

                        {/* Metadata footer */}
                        {result.metadata?.chunk_index !== undefined && (
                          <div className="mt-3 pt-2 border-t text-xs text-gray-400">
                            Chunk {result.metadata.chunk_index + 1} • {result.metadata?.token_count || 0} tokens
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Empty State */}
            {!isSearching && searchQuery && searchResults.length === 0 && !error && (
              <div className="text-center py-12">
                <FileSearch className="mx-auto text-gray-300 mb-3" size={48} />
                <p className="text-gray-500">No results found for "{searchQuery}"</p>
                <p className="text-sm text-gray-400 mt-1">
                  Try different keywords or check if documents are indexed
                </p>
              </div>
            )}
          </div>
        )}

        {/* Index Tab */}
        {activeTab === 'index' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <DocumentIndexer projectId={selectedProject} />
          </div>
        )}

        {/* Status Tab - Admin Only */}
        {activeTab === 'status' && isAdmin && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <KBStatus projectId={selectedProject} />
          </div>
        )}
      </div>
    </div>
  )
}
