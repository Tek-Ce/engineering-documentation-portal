import { useState } from 'react'
import { Search, FileText, Loader2, AlertCircle } from 'lucide-react'
import { kbAPI } from '../../api/kb'

export default function KBSearch({ projectId }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState(null)

  const handleSearch = async (e) => {
    e.preventDefault()

    if (!query.trim()) return

    setIsSearching(true)
    setError(null)

    try {
      const response = await kbAPI.search({
        query: query.trim(),
        project_id: projectId,
        top_k: 10,
        min_similarity: 0.3,
        use_hybrid: true
      })

      setResults(response.results || [])
    } catch (err) {
      console.error('Search error:', err)
      setError(err.message || 'Search failed')
    } finally {
      setIsSearching(false)
    }
  }

  return (
    <div className="w-full">
      {/* Search Bar */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search project documentation..."
            className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isSearching}
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          {isSearching && (
            <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-500 animate-spin" size={20} />
          )}
        </div>
      </form>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="text-red-500 mt-0.5 flex-shrink-0" size={20} />
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          <div className="text-sm text-gray-600 mb-3">
            Found {results.length} result{results.length !== 1 ? 's' : ''}
          </div>

          {results.map((result) => (
            <div
              key={result.chunk_id}
              className="p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
            >
              {/* Metadata */}
              <div className="flex items-center gap-2 mb-2">
                <FileText className="text-gray-400" size={16} />
                <span className="text-xs text-gray-500">
                  {result.metadata?.file_name || 'Unknown document'}
                </span>
                <span className="ml-auto text-xs font-medium text-blue-600">
                  {Math.round(result.similarity_score * 100)}% match
                </span>
              </div>

              {/* Content */}
              <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                {result.chunk_text}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* No Results */}
      {!isSearching && query && results.length === 0 && !error && (
        <div className="text-center py-12">
          <Search className="mx-auto text-gray-300 mb-3" size={48} />
          <p className="text-gray-500">No results found for "{query}"</p>
          <p className="text-sm text-gray-400 mt-1">Try different keywords or check if documents are indexed</p>
        </div>
      )}

      {/* Empty State */}
      {!query && results.length === 0 && (
        <div className="text-center py-12">
          <Search className="mx-auto text-gray-300 mb-3" size={48} />
          <p className="text-gray-500">Search across all project documentation</p>
          <p className="text-sm text-gray-400 mt-1">Enter keywords to find relevant content</p>
        </div>
      )}
    </div>
  )
}
