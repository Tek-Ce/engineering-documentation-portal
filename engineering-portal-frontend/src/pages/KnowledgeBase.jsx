// ============================================
// FILE: src/pages/KnowledgeBase.jsx
// Knowledge Base Search Page with AI Chat
// ============================================
import { useState, useEffect, useRef } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Search,
  FileText,
  FolderKanban,
  Clock,
  ChevronRight,
  Loader2,
  Brain,
  Keyboard,
  Filter,
  X,
  RefreshCw,
  Zap,
  Database,
  MessageSquare,
  Send,
  ExternalLink,
  Copy,
  Check,
  Sparkles
} from 'lucide-react'
import { kbAPI, projectsAPI } from '../api/client'
import { formatDistanceToNow } from 'date-fns'
import clsx from 'clsx'
import { useDebounce } from '../hooks/useDebounce'
import { sanitizeHighlightHtml } from '../utils/helpers'

// Content Preview Modal Component
function ContentPreviewModal({ result, query, onClose, onAskAI }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(result.text || result.chunk_text || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!result) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 animate-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-4 md:inset-10 lg:inset-20 bg-white rounded-2xl shadow-2xl z-50 flex flex-col animate-slide-up overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
              <FileText size={20} className="text-primary-600" />
            </div>
            <div>
              <h2 className="font-semibold text-surface-900">
                {result.document_title || 'Document Content'}
              </h2>
              <p className="text-xs text-surface-500">
                {result.project_name && `${result.project_name} • `}
                Chunk {(result.chunk_index || 0) + 1}
                {result.file_name && ` • ${result.file_name}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 px-3 py-2 text-sm text-surface-600 hover:bg-surface-100 rounded-lg transition-colors"
            >
              {copied ? <Check size={16} className="text-accent-green" /> : <Copy size={16} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>

            {result.document_id && (
              <Link
                to={`/documents/${result.document_id}`}
                className="flex items-center gap-2 px-3 py-2 text-sm text-surface-600 hover:bg-surface-100 rounded-lg transition-colors"
              >
                <ExternalLink size={16} />
                Open Document
              </Link>
            )}

            <button
              onClick={onClose}
              className="p-2 text-surface-400 hover:text-surface-600 hover:bg-surface-100 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-3xl mx-auto">
            {/* Relevance Score */}
            <div className="flex items-center gap-4 mb-6 text-sm">
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 text-primary-700 rounded-full">
                <Zap size={14} />
                Relevance: {((result.score || 0) * 100).toFixed(0)}%
              </span>
              {result.semantic_score > 0 && (
                <span className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-cyan/10 text-accent-cyan rounded-full">
                  <Brain size={14} />
                  Semantic Match: {(result.semantic_score * 100).toFixed(0)}%
                </span>
              )}
            </div>

            {/* Full Text Content */}
            <div className="prose prose-surface max-w-none">
              <div className="bg-surface-50 rounded-xl p-6 border border-surface-200">
                <p className="text-surface-700 whitespace-pre-wrap leading-relaxed">
                  {result.text || result.chunk_text || 'No content available'}
                </p>
              </div>
            </div>

            {/* Search Query Context */}
            {query && (
              <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-sm text-amber-800">
                  <span className="font-medium">Search query:</span> "{query}"
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer with AI Action */}
        <div className="px-6 py-4 border-t border-surface-200 bg-surface-50">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <p className="text-sm text-surface-500">
              Want to understand this content better?
            </p>
            <button
              onClick={() => onAskAI(result)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-lg hover:from-primary-600 hover:to-primary-700 transition-all shadow-sm"
            >
              <Sparkles size={16} />
              Ask AI to Explain
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// AI Chat Panel Component
function AIChatPanel({ context, query, onClose }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [usedAI, setUsedAI] = useState(false)
  const messagesEndRef = useRef(null)

  // Initialize with context message
  useEffect(() => {
    if (context) {
      const initialMessages = [
        {
          role: 'system',
          content: `You are a helpful AI assistant analyzing documentation content. The user is viewing content from "${context.document_title || 'a document'}".`,
        },
        {
          role: 'assistant',
          content: `I'm ready to help you understand this content from "${context.document_title || 'the document'}". Here's a quick summary:\n\n**Document:** ${context.document_title || 'Unknown'}\n**Source:** ${context.file_name || 'Unknown file'}\n**Project:** ${context.project_name || 'Unknown project'}\n\nWhat would you like me to explain or break down?`,
        }
      ]
      setMessages(initialMessages)
    }
  }, [context])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage = { role: 'user', content: input }
    setMessages(prev => [...prev, userMessage])
    const userInput = input
    setInput('')
    setIsLoading(true)

    try {
      // Call the AI chat API
      const response = await kbAPI.chat({
        message: userInput,
        documentId: context?.document_id,
        documentTitle: context?.document_title,
        projectName: context?.project_name,
        chunkText: context?.text || context?.chunk_text,
        fileName: context?.file_name,
        searchQuery: query,
        history: messages.filter(m => m.role !== 'system').slice(-6) // Send last 6 messages for context
      })

      setUsedAI(response.used_ai)
      setMessages(prev => [...prev, { role: 'assistant', content: response.response }])
    } catch (error) {
      console.error('AI Chat error:', error)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `I apologize, but I encountered an error processing your request. Please try again.\n\n*Error: ${error.response?.data?.detail || error.message}*`
      }])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed right-0 top-0 bottom-0 w-full md:w-[450px] bg-white shadow-2xl z-50 flex flex-col animate-slide-left">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-200 bg-gradient-to-r from-primary-500 to-primary-600">
        <div className="flex items-center gap-3 text-white">
          <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
            <Sparkles size={18} />
          </div>
          <div>
            <h3 className="font-semibold">AI Assistant</h3>
            <p className="text-xs text-white/80">Powered by Knowledge Base</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      {/* Context Banner */}
      {context && (
        <div className="px-4 py-3 bg-surface-50 border-b border-surface-200">
          <p className="text-xs text-surface-500 mb-1">Discussing content from:</p>
          <p className="text-sm font-medium text-surface-700 truncate">
            {context.document_title || 'Document'}
          </p>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {messages.filter(m => m.role !== 'system').map((message, index) => (
          <div
            key={index}
            className={clsx(
              'flex',
              message.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            <div
              className={clsx(
                'max-w-[85%] rounded-2xl px-4 py-3',
                message.role === 'user'
                  ? 'bg-primary-500 text-white rounded-br-md'
                  : 'bg-surface-100 text-surface-800 rounded-bl-md'
              )}
            >
              <div className="text-sm whitespace-pre-wrap">
                {message.content.split('\n').map((line, i) => (
                  <p key={i} className={i > 0 ? 'mt-2' : ''}>
                    {line.startsWith('**') && line.endsWith('**') ? (
                      <strong>{line.replace(/\*\*/g, '')}</strong>
                    ) : line.startsWith('- ') ? (
                      <span className="block pl-2">• {line.substring(2)}</span>
                    ) : (
                      line
                    )}
                  </p>
                ))}
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-surface-100 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-2 text-surface-500">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-sm">Thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-surface-200">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask about this content..."
            className="flex-1 h-11 px-4 bg-surface-50 border border-surface-200 rounded-xl text-sm placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="h-11 w-11 flex items-center justify-center bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={18} />
          </button>
        </div>
        <p className="text-xs text-surface-400 mt-2 text-center">
          {usedAI
            ? 'Powered by AI • Responses based on your documentation'
            : 'Responses generated from your documentation context'
          }
        </p>
      </div>
    </div>
  )
}

// Search Result Item Component
function SearchResultItem({ result, query, onClick }) {
  const rawHighlight = result.highlight || result.text?.substring(0, 200) + '...'
  const highlightedText = sanitizeHighlightHtml(rawHighlight)

  return (
    <div
      onClick={() => onClick(result)}
      className="block bg-white rounded-xl border border-surface-200 p-5 hover:shadow-hover hover:border-surface-300 transition-all duration-200 group cursor-pointer"
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className={clsx(
          'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
          result.source_type === 'document' ? 'bg-primary-100' : 'bg-accent-cyan/10'
        )}>
          {result.source_type === 'document' ? (
            <FileText size={20} className="text-primary-600" />
          ) : (
            <FolderKanban size={20} className="text-accent-cyan" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title */}
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-surface-900 group-hover:text-primary-600 transition-colors truncate">
              {result.document_title || result.project_name || 'Untitled'}
            </h3>
            {result.file_name && (
              <span className="text-xs text-surface-400 truncate">
                ({result.file_name})
              </span>
            )}
          </div>

          {/* Breadcrumb */}
          {result.project_name && result.document_title && (
            <div className="flex items-center gap-1 text-xs text-surface-500 mb-2">
              <FolderKanban size={12} />
              <span>{result.project_name}</span>
              <ChevronRight size={12} />
              <span>Chunk {(result.chunk_index || 0) + 1}</span>
            </div>
          )}

          {/* Highlighted text */}
          <p
            className="text-sm text-surface-600 line-clamp-3"
            dangerouslySetInnerHTML={{ __html: highlightedText }}
          />

          {/* Metadata */}
          <div className="flex items-center gap-4 mt-3 text-xs text-surface-400">
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {result.created_at ? formatDistanceToNow(new Date(result.created_at), { addSuffix: true }) : 'Unknown'}
            </span>
            <span className="flex items-center gap-1">
              <Zap size={12} />
              Score: {((result.score || 0) * 100).toFixed(0)}%
            </span>
            {result.semantic_score > 0 && (
              <span className="flex items-center gap-1 text-primary-500">
                <Brain size={12} />
                Semantic: {(result.semantic_score * 100).toFixed(0)}%
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onClick(result)
            }}
            className="p-2 text-surface-400 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition-colors"
            title="View content"
          >
            <MessageSquare size={18} />
          </button>
          {result.document_id && (
            <Link
              to={`/documents/${result.document_id}`}
              onClick={(e) => e.stopPropagation()}
              className="p-2 text-surface-400 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition-colors"
              title="Open document"
            >
              <ExternalLink size={18} />
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

// Stats Card Component
function StatsCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-white rounded-xl border border-surface-200 p-4 flex items-center gap-3">
      <div className={clsx('w-10 h-10 rounded-lg flex items-center justify-center', color)}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-surface-900">{value}</p>
        <p className="text-xs text-surface-500">{label}</p>
      </div>
    </div>
  )
}

function KnowledgeBase() {
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()

  // State
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '')
  const [selectedProject, setSelectedProject] = useState(searchParams.get('project') || '')
  const [useSemantic, setUseSemantic] = useState(true)
  const [useKeyword, setUseKeyword] = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  const [selectedResult, setSelectedResult] = useState(null)
  const [showAIChat, setShowAIChat] = useState(false)
  const [aiContext, setAIContext] = useState(null)

  // Debounce search query
  const debouncedQuery = useDebounce(searchQuery, 400)

  // Fetch projects for filter
  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsAPI.list({ limit: 100 }),
  })

  // Fetch KB stats
  const { data: kbStats } = useQuery({
    queryKey: ['kb-stats'],
    queryFn: kbAPI.getStats,
  })

  // Search query
  const {
    data: searchResults,
    isLoading: isSearching,
    isFetching
  } = useQuery({
    queryKey: ['kb-search', debouncedQuery, selectedProject, useSemantic, useKeyword],
    queryFn: () => kbAPI.search(debouncedQuery, {
      projectId: selectedProject || undefined,
      useSemantic,
      useKeyword,
      limit: 50
    }),
    enabled: debouncedQuery.length >= 2,
  })

  // Update URL params when search changes
  useEffect(() => {
    const params = new URLSearchParams()
    if (searchQuery) params.set('q', searchQuery)
    if (selectedProject) params.set('project', selectedProject)
    setSearchParams(params, { replace: true })
  }, [searchQuery, selectedProject, setSearchParams])

  // Admin: Process pending jobs
  const processJobsMutation = useMutation({
    mutationFn: () => kbAPI.processPendingJobs(20),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kb-stats'] })
    }
  })

  // Admin: Index all documents
  const indexAllMutation = useMutation({
    mutationFn: (forceReindex = false) => kbAPI.indexAllDocuments(forceReindex),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['kb-stats'] })
      alert(`Indexing complete!\nIndexed: ${data.indexed}\nSkipped: ${data.skipped}\nFailed: ${data.failed}\nTotal chunks: ${data.total_chunks}`)
    },
    onError: (error) => {
      alert(`Indexing failed: ${error.response?.data?.detail || error.message}`)
    }
  })

  const handleResultClick = (result) => {
    setSelectedResult(result)
  }

  const handleAskAI = (result) => {
    setAIContext(result)
    setSelectedResult(null)
    setShowAIChat(true)
  }

  const projects = projectsData?.projects || []
  const results = searchResults?.results || []
  const totalResults = searchResults?.total_results || 0
  const searchTime = searchResults?.search_time_ms || 0

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 flex items-center gap-3">
            <Brain className="text-primary-500" />
            Knowledge Base
          </h1>
          <p className="text-surface-500 mt-1">
            AI-powered semantic search across all your documentation
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAIChat(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-lg hover:from-primary-600 hover:to-primary-700 transition-all text-sm font-medium shadow-sm"
            title="Open AI Assistant"
          >
            <Sparkles size={16} />
            AI Assistant
          </button>
          <button
            onClick={() => indexAllMutation.mutate(false)}
            disabled={indexAllMutation.isPending || processJobsMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-surface-100 text-surface-700 rounded-lg hover:bg-surface-200 transition-colors text-sm font-medium disabled:opacity-50"
            title="Index all documents that haven't been indexed yet"
          >
            <Database size={16} className={indexAllMutation.isPending ? 'animate-pulse' : ''} />
            {indexAllMutation.isPending ? 'Indexing...' : 'Index All'}
          </button>
          <button
            onClick={() => processJobsMutation.mutate()}
            disabled={processJobsMutation.isPending || indexAllMutation.isPending}
            className="flex items-center gap-2 px-3 py-2 text-surface-500 hover:bg-surface-100 rounded-lg transition-colors text-sm disabled:opacity-50"
            title="Process pending indexing jobs"
          >
            <RefreshCw size={16} className={processJobsMutation.isPending ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Stats */}
      {kbStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatsCard
            icon={FolderKanban}
            label="Indexed Projects"
            value={kbStats.total_projects}
            color="bg-primary-500"
          />
          <StatsCard
            icon={FileText}
            label="Indexed Documents"
            value={kbStats.total_documents}
            color="bg-accent-cyan"
          />
          <StatsCard
            icon={Database}
            label="Total Chunks"
            value={kbStats.total_chunks?.toLocaleString()}
            color="bg-accent-green"
          />
          <StatsCard
            icon={Loader2}
            label="Pending Jobs"
            value={kbStats.pending_jobs}
            color="bg-accent-amber"
          />
        </div>
      )}

      {/* Search Box */}
      <div className="bg-white rounded-2xl border border-surface-200 p-6 shadow-card">
        {/* Main Search Input */}
        <div className="relative">
          <Search
            size={20}
            className={clsx(
              'absolute left-4 top-1/2 -translate-y-1/2 transition-colors',
              searchQuery ? 'text-primary-500' : 'text-surface-400'
            )}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documentation... (AI-powered)"
            className="w-full h-14 pl-12 pr-4 bg-surface-50 border border-surface-200 rounded-xl text-lg placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all"
            autoFocus
          />
          {isFetching && (
            <Loader2 size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-primary-500 animate-spin" />
          )}
        </div>

        {/* Filter Toggle */}
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 text-sm text-surface-600 hover:text-surface-900 transition-colors"
          >
            <Filter size={16} />
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </button>

          {/* Search Mode Toggles */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={useSemantic}
                onChange={(e) => setUseSemantic(e.target.checked)}
                className="w-4 h-4 rounded border-surface-300 text-primary-600 focus:ring-primary-500"
              />
              <Brain size={14} className="text-primary-500" />
              Semantic
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={useKeyword}
                onChange={(e) => setUseKeyword(e.target.checked)}
                className="w-4 h-4 rounded border-surface-300 text-primary-600 focus:ring-primary-500"
              />
              <Keyboard size={14} className="text-surface-500" />
              Keyword
            </label>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-surface-100 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Project Filter */}
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1.5">
                Filter by Project
              </label>
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="w-full h-10 px-3 bg-surface-50 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
              >
                <option value="">All Projects</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name} ({project.code})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      <div className="space-y-4">
        {/* Results Header */}
        {debouncedQuery.length >= 2 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-surface-500">
              {isSearching ? (
                'Searching...'
              ) : (
                <>
                  Found <span className="font-semibold text-surface-700">{totalResults}</span> results
                  {searchTime > 0 && (
                    <span className="text-surface-400"> in {searchTime}ms</span>
                  )}
                </>
              )}
            </p>

            {selectedProject && (
              <button
                onClick={() => setSelectedProject('')}
                className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
              >
                <X size={14} />
                Clear project filter
              </button>
            )}
          </div>
        )}

        {/* Results List */}
        {isSearching ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-surface-200 p-5 animate-pulse">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-surface-200" />
                  <div className="flex-1">
                    <div className="h-5 w-1/3 bg-surface-200 rounded mb-2" />
                    <div className="h-4 w-full bg-surface-100 rounded mb-1" />
                    <div className="h-4 w-2/3 bg-surface-100 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : results.length > 0 ? (
          <div className="space-y-3">
            {results.map((result, index) => (
              <SearchResultItem
                key={`${result.chunk_id}-${index}`}
                result={result}
                query={debouncedQuery}
                onClick={handleResultClick}
              />
            ))}
          </div>
        ) : debouncedQuery.length >= 2 ? (
          <div className="bg-white rounded-2xl border border-surface-200 p-12 text-center">
            <Search size={48} className="mx-auto text-surface-300 mb-4" />
            <h3 className="font-semibold text-surface-700 mb-2">No results found</h3>
            <p className="text-surface-500 text-sm max-w-md mx-auto">
              Try adjusting your search terms or filters. Make sure documents are indexed in the Knowledge Base.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-surface-200 p-12 text-center">
            <Brain size={48} className="mx-auto text-primary-300 mb-4" />
            <h3 className="font-semibold text-surface-700 mb-2">Search your documentation</h3>
            <p className="text-surface-500 text-sm max-w-md mx-auto">
              Enter at least 2 characters to search. The AI will find semantically related content,
              not just exact keyword matches.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {['authentication', 'API endpoints', 'deployment', 'database schema'].map((term) => (
                <button
                  key={term}
                  onClick={() => setSearchQuery(term)}
                  className="px-3 py-1.5 bg-surface-100 text-surface-600 rounded-lg text-sm hover:bg-surface-200 transition-colors"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Content Preview Modal */}
      {selectedResult && (
        <ContentPreviewModal
          result={selectedResult}
          query={debouncedQuery}
          onClose={() => setSelectedResult(null)}
          onAskAI={handleAskAI}
        />
      )}

      {/* AI Chat Panel */}
      {showAIChat && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => setShowAIChat(false)}
          />
          <AIChatPanel
            context={aiContext}
            query={debouncedQuery}
            onClose={() => {
              setShowAIChat(false)
              setAIContext(null)
            }}
          />
        </>
      )}
    </div>
  )
}

export default KnowledgeBase
