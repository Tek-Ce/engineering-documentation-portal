import api from './client'

export const kbAPI = {
  /**
   * Index a document into the knowledge base
   */
  indexDocument: async (documentId) => {
    const response = await api.post('/kb/index', { document_id: documentId })
    return response.data
  },

  /**
   * Search the knowledge base
   */
  search: async (params) => {
    const response = await api.post('/kb/search', params)
    return response.data
  },

  /**
   * Generate document or project summary
   */
  summarize: async (params) => {
    const response = await api.post('/kb/summarize', params)
    return response.data
  },

  /**
   * Get indexing job status
   */
  getJobStatus: async (jobId) => {
    const response = await api.get(`/kb/status/${jobId}`)
    return response.data
  },

  /**
   * Health check
   */
  healthCheck: async () => {
    const response = await api.get('/kb/health')
    return response.data
  }
}
