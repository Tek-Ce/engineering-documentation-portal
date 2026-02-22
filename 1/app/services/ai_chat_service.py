# ============================================
# FILE: app/services/ai_chat_service.py
# AI Chat Service for Knowledge Base
# ============================================
import os
import re
from typing import Optional, List, Dict, Any
from dataclasses import dataclass


@dataclass
class ChatMessage:
    role: str  # 'user', 'assistant', 'system'
    content: str


@dataclass
class ChatContext:
    document_title: Optional[str] = None
    document_id: Optional[str] = None
    project_name: Optional[str] = None
    chunk_text: Optional[str] = None
    file_name: Optional[str] = None
    search_query: Optional[str] = None


class AIChatService:
    """
    AI Chat Service that can use OpenAI API or fallback to context-aware responses.
    """

    @classmethod
    def _get_openai_key(cls) -> Optional[str]:
        """Get OpenAI API key at runtime (not import time)."""
        return os.getenv("OPENAI_API_KEY")

    @classmethod
    async def chat(
        cls,
        message: str,
        context: ChatContext,
        history: Optional[List[ChatMessage]] = None
    ) -> str:
        """
        Process a chat message and return an AI-generated response.

        Args:
            message: The user's message
            context: Document context information
            history: Previous chat messages for conversation continuity

        Returns:
            AI-generated response string
        """
        api_key = cls._get_openai_key()
        if api_key:
            print(f"[AI Chat] Using OpenAI API")
            return await cls._chat_with_openai(message, context, history, api_key)
        else:
            # No fallback - raise error if no API key
            raise ValueError("OPENAI_API_KEY not configured. Please set it in your .env file.")

    @classmethod
    async def _chat_with_openai(
        cls,
        message: str,
        context: ChatContext,
        history: Optional[List[ChatMessage]] = None,
        api_key: Optional[str] = None
    ) -> str:
        """Use OpenAI API for intelligent responses."""
        import openai

        print(f"[OpenAI] Connecting with key: {api_key[:20]}...{api_key[-10:]}")

        client = openai.AsyncOpenAI(api_key=api_key)

        # Build the system message with context
        system_message = cls._build_system_prompt(context)

        # Build messages array
        messages = [{"role": "system", "content": system_message}]

        # Add history if provided
        if history:
            for msg in history[-10:]:  # Limit to last 10 messages
                if msg.role != "system":
                    messages.append({
                        "role": msg.role,
                        "content": msg.content
                    })

        # Add current message
        messages.append({"role": "user", "content": message})

        print(f"[OpenAI] Sending request with {len(messages)} messages...")

        # Call OpenAI API - no fallback, let errors propagate
        response = await client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=messages,
            max_tokens=1000,
            temperature=0.7
        )

        print(f"[OpenAI] Response received successfully")
        return response.choices[0].message.content

    @classmethod
    def _build_system_prompt(cls, context: ChatContext) -> str:
        """Build a system prompt with document context."""
        prompt = """You are a helpful AI assistant for an engineering documentation portal.
Your role is to help users understand and work with their documentation.

You have access to the following context:"""

        if context.document_title:
            prompt += f"\n- Document: {context.document_title}"
        if context.project_name:
            prompt += f"\n- Project: {context.project_name}"
        if context.file_name:
            prompt += f"\n- File: {context.file_name}"
        if context.search_query:
            prompt += f"\n- User's original search: {context.search_query}"

        if context.chunk_text:
            prompt += f"\n\nDocument content excerpt:\n\"\"\"\n{context.chunk_text[:2000]}\n\"\"\""

        prompt += """

Guidelines:
- Be concise and helpful
- Reference the document content when relevant
- If you don't know something, say so
- Format responses with markdown when helpful
- Focus on explaining and clarifying the documentation"""

        return prompt

    @classmethod
    def _generate_contextual_response(
        cls,
        message: str,
        context: ChatContext
    ) -> str:
        """
        Generate a helpful response based on context without external AI.
        This is a fallback when no AI API is configured.
        """
        message_lower = message.lower().strip()
        chunk_text = context.chunk_text or ""
        doc_title = context.document_title or "the document"

        # Extract key information from the chunk
        sentences = [s.strip() for s in re.split(r'[.!?]+', chunk_text) if s.strip()]
        first_few_sentences = '. '.join(sentences[:3]) + '.' if sentences else ""

        # Detect intent and generate appropriate response
        if any(word in message_lower for word in ['summary', 'summarize', 'overview', 'tldr']):
            return cls._generate_summary(context, sentences, first_few_sentences)

        elif any(word in message_lower for word in ['explain', 'what is', 'what are', 'what does', 'meaning']):
            return cls._generate_explanation(context, message, sentences, first_few_sentences)

        elif any(word in message_lower for word in ['example', 'how to', 'how do', 'show me', 'demonstrate']):
            return cls._generate_example_response(context, message, sentences)

        elif any(word in message_lower for word in ['key points', 'important', 'main', 'highlight']):
            return cls._generate_key_points(context, sentences)

        elif any(word in message_lower for word in ['compare', 'difference', 'versus', 'vs']):
            return cls._generate_comparison_response(context, message)

        else:
            return cls._generate_general_response(context, message, first_few_sentences)

    @classmethod
    def _generate_summary(
        cls,
        context: ChatContext,
        sentences: List[str],
        first_few: str
    ) -> str:
        doc_title = context.document_title or "the document"
        project = context.project_name or "your project"

        summary_parts = [f"**Summary of \"{doc_title}\"**\n"]

        if context.project_name:
            summary_parts.append(f"This content is from the **{project}** project.\n")

        if first_few:
            summary_parts.append(f"**Main content:**\n{first_few}\n")

        if len(sentences) > 3:
            summary_parts.append(f"\nThe document section contains {len(sentences)} key points covering the topic in detail.")

        summary_parts.append("\n\n*Would you like me to explain any specific part in more detail?*")

        return "\n".join(summary_parts)

    @classmethod
    def _generate_explanation(
        cls,
        context: ChatContext,
        message: str,
        sentences: List[str],
        first_few: str
    ) -> str:
        doc_title = context.document_title or "the document"

        response = f"**Understanding \"{doc_title}\"**\n\n"

        if first_few:
            response += f"Based on the document content:\n\n> {first_few}\n\n"

        response += "**Key takeaways:**\n"

        # Extract up to 3 key points
        for i, sentence in enumerate(sentences[:3]):
            if len(sentence) > 20:  # Only include meaningful sentences
                response += f"- {sentence}.\n"

        if context.search_query:
            response += f"\n*This content was found based on your search for \"{context.search_query}\".*\n"

        response += "\n*Feel free to ask more specific questions about any concept mentioned here.*"

        return response

    @classmethod
    def _generate_example_response(
        cls,
        context: ChatContext,
        message: str,
        sentences: List[str]
    ) -> str:
        doc_title = context.document_title or "the documentation"

        response = f"**Applying concepts from \"{doc_title}\"**\n\n"
        response += "Based on the documentation, here's how you might approach this:\n\n"

        response += "1. **Review the documentation** - The content describes the relevant concepts\n"
        response += "2. **Identify key requirements** - Note any prerequisites or dependencies\n"
        response += "3. **Follow the documented approach** - Apply the guidelines as described\n"

        if sentences:
            response += f"\n**From the document:**\n> {sentences[0]}.\n"

        response += "\n*For specific code examples or implementation details, please refer to the full document.*"

        return response

    @classmethod
    def _generate_key_points(cls, context: ChatContext, sentences: List[str]) -> str:
        doc_title = context.document_title or "the document"

        response = f"**Key Points from \"{doc_title}\"**\n\n"

        if sentences:
            for i, sentence in enumerate(sentences[:5]):
                if len(sentence) > 15:
                    response += f"{i+1}. {sentence}.\n"
        else:
            response += "The document content is currently being analyzed.\n"

        if context.project_name:
            response += f"\n*Project: {context.project_name}*\n"

        response += "\n*Would you like me to elaborate on any of these points?*"

        return response

    @classmethod
    def _generate_comparison_response(cls, context: ChatContext, message: str) -> str:
        doc_title = context.document_title or "the document"

        response = f"**Analysis from \"{doc_title}\"**\n\n"
        response += "To compare concepts effectively, I would need:\n\n"
        response += "1. The specific items you want to compare\n"
        response += "2. The criteria for comparison (performance, features, use cases, etc.)\n"
        response += "\nBased on the current document context, I can help analyze the content "
        response += "and identify relevant comparisons mentioned in the documentation.\n"
        response += "\n*Please specify what you'd like to compare, and I'll do my best to help.*"

        return response

    @classmethod
    def _generate_general_response(
        cls,
        context: ChatContext,
        message: str,
        first_few: str
    ) -> str:
        doc_title = context.document_title or "the document"

        response = f"Thank you for your question about \"{doc_title}\".\n\n"

        if first_few:
            response += f"**From the document:**\n> {first_few}\n\n"

        response += "**I can help you with:**\n"
        response += "- **Summarize** - Get a quick overview of the content\n"
        response += "- **Explain** - Understand specific concepts or terms\n"
        response += "- **Key points** - Identify the most important information\n"
        response += "- **Examples** - See how to apply the documented concepts\n"

        response += "\n*Try asking: \"Can you summarize this?\" or \"What are the key points?\"*"

        return response


# Convenience function for direct use
async def chat_with_context(
    message: str,
    document_title: Optional[str] = None,
    document_id: Optional[str] = None,
    project_name: Optional[str] = None,
    chunk_text: Optional[str] = None,
    file_name: Optional[str] = None,
    search_query: Optional[str] = None,
    history: Optional[List[Dict[str, str]]] = None
) -> str:
    """
    Convenience function for AI chat.
    """
    context = ChatContext(
        document_title=document_title,
        document_id=document_id,
        project_name=project_name,
        chunk_text=chunk_text,
        file_name=file_name,
        search_query=search_query
    )

    # Convert history dicts to ChatMessage objects if provided
    chat_history = None
    if history:
        chat_history = [
            ChatMessage(role=msg.get("role", "user"), content=msg.get("content", ""))
            for msg in history
        ]

    return await AIChatService.chat(message, context, chat_history)
