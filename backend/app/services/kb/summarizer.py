"""
Summarizer Service (MVP - Rule-based)
Generates document summaries using extractive methods (no LLM)
"""
import re
import json
from typing import List, Optional, Dict, Any
from collections import Counter
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.kb import KBSummary
from app.services.kb.retriever import get_retriever


class SummarizerService:
    """Generate summaries using rule-based extractive methods"""

    def __init__(self):
        self.retriever = get_retriever()

    async def summarize_document(
        self,
        db: AsyncSession,
        document_id: str,
        summary_type: str = "short",
        max_sentences: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Generate summary for a document

        Args:
            db: Database session
            document_id: UUID of document
            summary_type: 'short' (3 sentences), 'long' (10 sentences), or 'executive'
            max_sentences: Override default sentence count

        Returns:
            Summary dict with text and key points
        """
        # Get all chunks for the document
        chunks = await self.retriever.get_document_chunks(db, document_id)

        if not chunks:
            return {
                'summary': "No content available for summarization.",
                'key_points': [],
                'method': 'none'
            }

        # Combine all chunk texts
        full_text = "\n\n".join(chunk['text'] for chunk in chunks)

        # Determine sentence count
        if max_sentences is None:
            if summary_type == "short":
                max_sentences = 3
            elif summary_type == "long":
                max_sentences = 10
            elif summary_type == "executive":
                max_sentences = 5
            else:
                max_sentences = 5

        # Extract key sentences
        summary_sentences = self._extract_key_sentences(full_text, max_sentences)

        # Extract key points (headings, bullet points)
        key_points = self._extract_key_points(full_text)

        return {
            'summary': " ".join(summary_sentences),
            'key_points': key_points,
            'method': 'extractive',
            'sentence_count': len(summary_sentences)
        }

    async def summarize_project(
        self,
        db: AsyncSession,
        project_id: str,
        regenerate: bool = False
    ) -> Dict[str, Any]:
        """
        Generate or retrieve project summary

        Args:
            db: Database session
            project_id: UUID of project
            regenerate: Force regeneration even if cached

        Returns:
            Project summary dict
        """
        # Check for existing summary
        if not regenerate:
            result = await db.execute(
                select(KBSummary)
                .where(KBSummary.project_id == project_id)
                .order_by(KBSummary.created_at.desc())
                .limit(1)
            )
            existing = result.scalar_one_or_none()

            if existing:
                return {
                    'short': existing.summary_short,
                    'long': existing.summary_long,
                    'generation_mode': existing.generation_mode,
                    'cached': True
                }

        # Generate new summary from all project chunks
        from app.models.kb import KBChunk

        result = await db.execute(
            select(KBChunk)
            .where(KBChunk.project_id == project_id)
            .limit(1000)  # Limit to prevent excessive processing
        )
        chunks = result.scalars().all()

        if not chunks:
            return {
                'short': "No indexed content available.",
                'long': "No indexed content available.",
                'generation_mode': 'none',
                'cached': False
            }

        # Combine chunk texts
        full_text = "\n\n".join(chunk.chunk_text for chunk in chunks)

        # Generate short and long summaries
        short_summary = " ".join(self._extract_key_sentences(full_text, 3))
        long_summary = " ".join(self._extract_key_sentences(full_text, 10))

        # Cache the summary
        import uuid
        summary_record = KBSummary(
            id=str(uuid.uuid4()),
            project_id=project_id,
            summary_short=short_summary,
            summary_long=long_summary,
            generation_mode='local'
        )
        db.add(summary_record)
        await db.commit()

        return {
            'short': short_summary,
            'long': long_summary,
            'generation_mode': 'local',
            'cached': False
        }

    def _extract_key_sentences(self, text: str, num_sentences: int) -> List[str]:
        """
        Extract most important sentences using TF-IDF-like scoring

        Args:
            text: Full text
            num_sentences: Number of sentences to extract

        Returns:
            List of key sentences
        """
        # Split into sentences
        sentences = self._split_sentences(text)

        if len(sentences) <= num_sentences:
            return sentences

        # Score sentences
        scored_sentences = []

        # Get word frequencies
        words = self._tokenize(text)
        word_freq = Counter(words)

        # Remove common stop words
        stop_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
                     'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
                     'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
                     'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those'}

        # Score each sentence
        for i, sentence in enumerate(sentences):
            sentence_words = self._tokenize(sentence)

            # Calculate score based on word importance
            score = 0
            for word in sentence_words:
                if word.lower() not in stop_words and len(word) > 2:
                    score += word_freq.get(word, 0)

            # Normalize by sentence length
            if len(sentence_words) > 0:
                score = score / len(sentence_words)

            # Bonus for position (first sentences often important)
            if i < 3:
                score *= 1.5

            # Bonus for sentences with numbers/data
            if re.search(r'\d+', sentence):
                score *= 1.2

            scored_sentences.append((score, sentence))

        # Sort by score and take top N
        scored_sentences.sort(reverse=True, key=lambda x: x[0])
        top_sentences = [sent for _, sent in scored_sentences[:num_sentences]]

        # Return in original order
        ordered_sentences = []
        for sentence in sentences:
            if sentence in top_sentences:
                ordered_sentences.append(sentence)

        return ordered_sentences

    def _extract_key_points(self, text: str) -> List[str]:
        """
        Extract key points from headings and bullet points

        Args:
            text: Full text

        Returns:
            List of key points
        """
        key_points = []

        # Extract markdown headings
        heading_pattern = r'^#{1,3}\s+(.+)$'
        for match in re.finditer(heading_pattern, text, re.MULTILINE):
            heading = match.group(1).strip()
            if heading and len(heading) > 5:
                key_points.append(heading)

        # Extract bullet points
        bullet_pattern = r'^\s*[-*•]\s+(.+)$'
        for match in re.finditer(bullet_pattern, text, re.MULTILINE):
            point = match.group(1).strip()
            if point and len(point) > 10:
                key_points.append(point)

        # Extract numbered lists
        numbered_pattern = r'^\s*\d+\.\s+(.+)$'
        for match in re.finditer(numbered_pattern, text, re.MULTILINE):
            point = match.group(1).strip()
            if point and len(point) > 10:
                key_points.append(point)

        # Limit to 10 key points
        return key_points[:10]

    def _split_sentences(self, text: str) -> List[str]:
        """Split text into sentences"""
        # Simple sentence splitting
        sentences = re.split(r'[.!?]+\s+', text)

        # Clean and filter
        cleaned = []
        for sent in sentences:
            sent = sent.strip()
            # Keep sentences with reasonable length
            if 10 < len(sent) < 500:
                cleaned.append(sent)

        return cleaned

    def _tokenize(self, text: str) -> List[str]:
        """Simple word tokenization"""
        # Remove punctuation and split
        words = re.findall(r'\b\w+\b', text.lower())
        return [w for w in words if len(w) > 1]


# Singleton instance
_summarizer_instance = None

def get_summarizer() -> SummarizerService:
    """Get singleton SummarizerService instance"""
    global _summarizer_instance
    if _summarizer_instance is None:
        _summarizer_instance = SummarizerService()
    return _summarizer_instance
