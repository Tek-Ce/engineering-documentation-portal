import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { tagsAPI } from '../api/client'
import { toast } from 'react-hot-toast'
import { Tag, X, Plus } from 'lucide-react'

export default function TagsSection({ documentId }) {
  const [isAddingTag, setIsAddingTag] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#3B82F6')
  const queryClient = useQueryClient()

  // Fetch document tags
  const { data: documentTagsData } = useQuery({
    queryKey: ['document-tags', documentId],
    queryFn: () => tagsAPI.getDocumentTags(documentId),
  })

  // Fetch all tags
  const { data: allTagsData } = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagsAPI.list(),
  })

  // Create tag mutation
  const createTagMutation = useMutation({
    mutationFn: (data) => tagsAPI.create(data),
    onSuccess: (newTag) => {
      queryClient.invalidateQueries({ queryKey: ['tags'] })
      // Auto-add the newly created tag to the document
      addTagMutation.mutate({
        documentId,
        tagId: newTag.id,
      })
      setNewTagName('')
      setNewTagColor('#3B82F6')
      setIsAddingTag(false)
      toast.success('Tag created and added')
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to create tag')
    },
  })

  // Add tag to document mutation
  const addTagMutation = useMutation({
    mutationFn: ({ documentId, tagId }) => tagsAPI.addToDocument(documentId, tagId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-tags', documentId] })
      toast.success('Tag added to document')
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to add tag')
    },
  })

  // Remove tag from document mutation
  const removeTagMutation = useMutation({
    mutationFn: ({ documentId, tagId }) => tagsAPI.removeFromDocument(documentId, tagId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-tags', documentId] })
      toast.success('Tag removed from document')
    },
    onError: () => {
      toast.error('Failed to remove tag')
    },
  })

  const handleCreateTag = (e) => {
    e.preventDefault()
    if (!newTagName.trim()) return

    createTagMutation.mutate({
      name: newTagName.trim(),
      color: newTagColor,
    })
  }

  const handleAddExistingTag = (tagId) => {
    addTagMutation.mutate({ documentId, tagId })
  }

  const handleRemoveTag = (tagId) => {
    removeTagMutation.mutate({ documentId, tagId })
  }

  const documentTags = documentTagsData?.tags || []
  const allTags = allTagsData?.tags || []

  // Filter out tags already added to document
  const availableTags = allTags.filter(
    (tag) => !documentTags.some((dt) => dt.id === tag.id)
  )

  const predefinedColors = [
    '#3B82F6', // Blue
    '#10B981', // Green
    '#F59E0B', // Yellow
    '#EF4444', // Red
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#6366F1', // Indigo
    '#14B8A6', // Teal
  ]

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center">
          <Tag className="w-5 h-5 mr-2 text-blue-600" />
          Tags
        </h3>
        <button
          onClick={() => setIsAddingTag(!isAddingTag)}
          className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
        >
          <Plus className="w-4 h-4 mr-1" />
          Add Tag
        </button>
      </div>

      {/* Current document tags */}
      {documentTags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {documentTags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium"
              style={{
                backgroundColor: `${tag.color}20`,
                color: tag.color,
                border: `1px solid ${tag.color}40`,
              }}
            >
              {tag.name}
              <button
                onClick={() => handleRemoveTag(tag.id)}
                className="ml-1.5 -mr-1 hover:opacity-70"
                title="Remove tag"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {documentTags.length === 0 && !isAddingTag && (
        <p className="text-gray-500 text-sm mb-4">No tags added to this document yet.</p>
      )}

      {/* Add tag interface */}
      {isAddingTag && (
        <div className="border border-gray-200 rounded-lg p-4 mb-4">
          <div className="space-y-4">
            {/* Available tags */}
            {availableTags.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Add Existing Tag
                </label>
                <div className="flex flex-wrap gap-2">
                  {availableTags.map((tag) => (
                    <button
                      key={tag.id}
                      onClick={() => handleAddExistingTag(tag.id)}
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium hover:opacity-80 transition-opacity"
                      style={{
                        backgroundColor: `${tag.color}20`,
                        color: tag.color,
                        border: `1px solid ${tag.color}40`,
                      }}
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      {tag.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Create new tag */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Or Create New Tag
              </label>
              <form onSubmit={handleCreateTag} className="space-y-3">
                <div>
                  <input
                    type="text"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    placeholder="Tag name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-2">Color</label>
                  <div className="flex gap-2">
                    {predefinedColors.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setNewTagColor(color)}
                        className={`w-8 h-8 rounded-full border-2 ${
                          newTagColor === color ? 'border-gray-900' : 'border-gray-200'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                    <input
                      type="color"
                      value={newTagColor}
                      onChange={(e) => setNewTagColor(e.target.value)}
                      className="w-8 h-8 rounded-full cursor-pointer"
                      title="Custom color"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={!newTagName.trim() || createTagMutation.isPending}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {createTagMutation.isPending ? 'Creating...' : 'Create & Add'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingTag(false)
                      setNewTagName('')
                      setNewTagColor('#3B82F6')
                    }}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
