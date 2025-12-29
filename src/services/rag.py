"""RAG (Retrieval-Augmented Generation) service with Qdrant vector store."""

import logging
import os
from typing import List, Optional, Dict, Any, TYPE_CHECKING
from pathlib import Path

from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from langchain_core.embeddings import Embeddings

# Embedding providers
try:
    from langchain_openai import OpenAIEmbeddings
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    OpenAIEmbeddings = None  # type: ignore

try:
    from langchain_ollama import OllamaEmbeddings
    OLLAMA_AVAILABLE = True
except ImportError:
    OLLAMA_AVAILABLE = False
    OllamaEmbeddings = None  # type: ignore

try:
    from langchain_voyageai import VoyageAIEmbeddings  # type: ignore
    VOYAGE_AVAILABLE = True
except ImportError:
    VOYAGE_AVAILABLE = False
    VoyageAIEmbeddings = None  # type: ignore

# Qdrant vector store
try:
    from langchain_qdrant import QdrantVectorStore
    from qdrant_client import QdrantClient
    from qdrant_client.models import Distance, VectorParams, Filter, FieldCondition, MatchValue
    QDRANT_AVAILABLE = True
except ImportError:
    QDRANT_AVAILABLE = False
    QdrantVectorStore = None  # type: ignore
    QdrantClient = None  # type: ignore
    Distance = None  # type: ignore
    VectorParams = None  # type: ignore
    Filter = None  # type: ignore
    FieldCondition = None  # type: ignore
    MatchValue = None  # type: ignore

logger = logging.getLogger(__name__)


class RAGService:
    """Service for managing RAG document retrieval with Qdrant."""

    def __init__(
        self,
        persist_directory: str = "./rag_data",
        qdrant_mode: str = "memory",
        qdrant_url: Optional[str] = None,
        qdrant_collection: str = "knowledge_base",
        chunk_size: int = 1000,
        chunk_overlap: int = 200,
        embedding_provider: str = "openai",
        embedding_model: Optional[str] = None,
        ollama_base_url: str = "http://localhost:11434",
        # Legacy params (ignored, kept for backwards compatibility)
        vector_store: str = "qdrant",
    ):
        """Initialize RAG service with Qdrant.

        Args:
            persist_directory: Directory to persist vector store (for embedded mode)
            qdrant_mode: 'memory' (embedded) or 'server' (remote)
            qdrant_url: URL for Qdrant server (only for server mode)
            qdrant_collection: Name of Qdrant collection
            chunk_size: Size of text chunks
            chunk_overlap: Overlap between chunks
            embedding_provider: 'ollama', 'openai', or 'voyage'
            embedding_model: Model name (auto-selected if None)
            ollama_base_url: Ollama server URL
        """
        if not QDRANT_AVAILABLE:
            raise ImportError(
                "Qdrant is required. Install: pip install qdrant-client langchain-qdrant"
            )

        self.persist_directory = persist_directory
        self.qdrant_mode = qdrant_mode
        self.qdrant_url = qdrant_url
        self.qdrant_collection = qdrant_collection
        self.embedding_provider = embedding_provider.lower()
        self.ollama_base_url = ollama_base_url
        self.vector_store_type = "qdrant"  # Always qdrant now

        # Auto-select embedding model based on provider
        if embedding_model is None:
            if self.embedding_provider == "ollama":
                self.embedding_model = "nomic-embed-text"
            elif self.embedding_provider == "voyage":
                self.embedding_model = "voyage-3"
            elif self.embedding_provider in ["openai", "claude"]:
                if self.embedding_provider == "claude":
                    self.embedding_provider = "voyage"
                    self.embedding_model = "voyage-3"
                else:
                    self.embedding_model = "text-embedding-3-small"
            else:
                self.embedding_model = "text-embedding-3-small"
        else:
            self.embedding_model = embedding_model

        self.embeddings: Optional[Embeddings] = None
        self.vectorstore: Any = None  # QdrantVectorStore
        self.client: Any = None  # QdrantClient
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            length_function=len,
        )

        # Initialize
        self._initialize_embeddings()
        self._initialize_qdrant()

    def _initialize_embeddings(self) -> None:
        """Initialize embedding model based on provider."""
        try:
            if self.embedding_provider == "ollama":
                if not OLLAMA_AVAILABLE or OllamaEmbeddings is None:
                    raise ImportError("Ollama not available. Install: pip install langchain-ollama")
                logger.info(f"Using Ollama embeddings: {self.embedding_model}")
                self.embeddings = OllamaEmbeddings(
                    model=self.embedding_model, base_url=self.ollama_base_url
                )

            elif self.embedding_provider == "voyage":
                if not VOYAGE_AVAILABLE or VoyageAIEmbeddings is None:
                    raise ImportError("Voyage AI not available. Install: pip install langchain-voyageai")
                logger.info(f"Using Voyage AI embeddings: {self.embedding_model}")
                self.embeddings = VoyageAIEmbeddings(model=self.embedding_model)  # type: ignore

            elif self.embedding_provider == "openai":
                if not OPENAI_AVAILABLE or OpenAIEmbeddings is None:
                    raise ImportError("OpenAI not available. Install: pip install langchain-openai")
                logger.info(f"Using OpenAI embeddings: {self.embedding_model}")
                self.embeddings = OpenAIEmbeddings(model=self.embedding_model)

            else:
                raise ValueError(f"Unknown embedding provider: {self.embedding_provider}")

            logger.info("✓ Embeddings initialized")

        except Exception as e:
            logger.error(f"Failed to initialize embeddings: {e}")
            raise

    def _initialize_qdrant(self) -> None:
        """Initialize Qdrant vector store."""
        if self.embeddings is None:
            raise ValueError("Embeddings must be initialized before vector store")

        try:
            if self.qdrant_mode == "server":
                if not self.qdrant_url:
                    raise ValueError("Qdrant URL required for server mode")
                logger.info(f"Connecting to Qdrant server at {self.qdrant_url}")
                self.client = QdrantClient(url=self.qdrant_url)  # type: ignore[misc]
            else:
                # Embedded mode with persistence
                os.makedirs(self.persist_directory, exist_ok=True)
                logger.info(f"Using embedded Qdrant at {self.persist_directory}")
                self.client = QdrantClient(path=self.persist_directory)  # type: ignore[misc]

            # Check if collection exists, create if not
            collections = self.client.get_collections().collections
            collection_names = [c.name for c in collections]

            if self.qdrant_collection not in collection_names:
                logger.info(f"Creating collection: {self.qdrant_collection}")
                test_embedding = self.embeddings.embed_query("test")
                vector_size = len(test_embedding)

                self.client.create_collection(
                    collection_name=self.qdrant_collection,
                    vectors_config=VectorParams(size=vector_size, distance=Distance.COSINE),  # type: ignore[misc]
                )
                logger.info(f"✓ Collection created (vector size: {vector_size})")

            self.vectorstore = QdrantVectorStore(  # type: ignore[misc]
                client=self.client,
                collection_name=self.qdrant_collection,
                embedding=self.embeddings
            )
            logger.info(f"✓ Qdrant initialized (collection: {self.qdrant_collection})")

        except Exception as e:
            logger.error(f"Failed to initialize Qdrant: {e}")
            raise

    def add_documents(self, documents: List[Document]) -> bool:
        """Add documents to vector store."""
        try:
            if not documents:
                logger.warning("No documents provided")
                return False

            if self.vectorstore is None:
                logger.error("Vector store not initialized")
                return False

            chunks = self.text_splitter.split_documents(documents)
            logger.info(f"Split {len(documents)} documents into {len(chunks)} chunks")

            self.vectorstore.add_documents(chunks)
            logger.info(f"✓ Added {len(chunks)} chunks to vector store")
            return True

        except Exception as e:
            logger.error(f"Failed to add documents: {e}")
            return False

    def add_text(self, text: str, metadata: Optional[Dict[str, Any]] = None) -> bool:
        """Add a single text document."""
        doc = Document(page_content=text, metadata=metadata or {})
        return self.add_documents([doc])

    def search(
        self,
        query: str,
        k: int = 4,
        score_threshold: Optional[float] = None,
        filter_metadata: Optional[Dict[str, Any]] = None
    ) -> List[tuple[Document, float]]:
        """Search for relevant documents."""
        try:
            if not self.vectorstore:
                logger.error("Vector store not initialized")
                return []

            # Build filter if metadata provided
            qdrant_filter = None
            if filter_metadata:
                conditions = [
                    FieldCondition(key=f"metadata.{k}", match=MatchValue(value=v))  # type: ignore[misc]
                    for k, v in filter_metadata.items()
                ]
                qdrant_filter = Filter(must=conditions) if conditions else None  # type: ignore[misc]

            results = self.vectorstore.similarity_search_with_score(
                query, k=k, filter=qdrant_filter
            )

            # Filter by score threshold
            if score_threshold is not None:
                results = [(doc, score) for doc, score in results if score >= score_threshold]

            logger.info(f"Found {len(results)} results for: {query[:50]}...")
            return results

        except Exception as e:
            logger.error(f"Search failed: {e}")
            return []

    def get_context(self, query: str, k: int = 4) -> str:
        """Get formatted context string from search results."""
        results = self.search(query, k=k)

        if not results:
            return "No relevant documents found."

        context_parts = []
        for i, (doc, score) in enumerate(results, 1):
            source = doc.metadata.get("source", "unknown")
            context_parts.append(
                f"[Document {i}] (relevance: {score:.3f}, source: {source})\n{doc.page_content}"
            )

        return "\n\n".join(context_parts)

    def clear(self) -> bool:
        """Clear all documents from vector store."""
        try:
            if self.client is None:
                logger.error("Qdrant client not initialized")
                return False

            self.client.delete_collection(self.qdrant_collection)
            self._initialize_qdrant()
            logger.info("✓ Vector store cleared")
            return True

        except Exception as e:
            logger.error(f"Failed to clear vector store: {e}")
            return False

    def delete_by_source(self, source: str) -> bool:
        """Delete documents by source filename."""
        try:
            if self.client is None:
                logger.error("Qdrant client not initialized")
                return False

            # Build the filter for deletion
            source_condition = FieldCondition(  # type: ignore[misc]
                key="metadata.source",
                match=MatchValue(value=source)  # type: ignore[misc]
            )
            source_filter = Filter(must=[source_condition])  # type: ignore[misc]
            
            self.client.delete(
                collection_name=self.qdrant_collection,
                points_selector=source_filter
            )
            logger.info(f"✓ Deleted documents with source: {source}")
            return True

        except Exception as e:
            logger.error(f"Failed to delete by source: {e}")
            return False

    def list_sources(self) -> List[str]:
        """List all unique document sources in the knowledge base."""
        try:
            if self.client is None:
                return []

            sources = set()
            offset = None
            
            while True:
                results, offset = self.client.scroll(
                    collection_name=self.qdrant_collection,
                    limit=100,
                    offset=offset,
                    with_payload=True,
                    with_vectors=False,
                )
                for point in results:
                    if point.payload and "metadata" in point.payload:
                        source = point.payload["metadata"].get("source")
                        if source:
                            sources.add(source)
                if offset is None:
                    break
                    
            return sorted(list(sources))

        except Exception as e:
            logger.error(f"Failed to list sources: {e}")
            return []

    def get_stats(self) -> Dict[str, Any]:
        """Get statistics about the vector store."""
        try:
            stats: Dict[str, Any] = {
                "vector_store": "qdrant",
                "persist_directory": self.persist_directory,
                "mode": self.qdrant_mode,
                "collection_name": self.qdrant_collection,
            }

            if self.client is None:
                stats["document_count"] = 0
                stats["status"] = "not_initialized"
                return stats

            try:
                collection_info = self.client.get_collection(self.qdrant_collection)
                stats["document_count"] = collection_info.points_count
            except Exception as e:
                stats["document_count"] = 0
                logger.warning(f"Could not get stats: {e}")

            return stats

        except Exception as e:
            logger.error(f"Error getting stats: {e}")
            return {"error": str(e)}

    def get_relevant_context_for_planning(
        self, query: str, k: int = 3, min_score: float = 0.5
    ) -> Optional[str]:
        """Get relevant context for planning phase (active RAG)."""
        try:
            if not self.vectorstore:
                return None

            results = self.search(query, k=k, score_threshold=min_score)

            if not results:
                logger.debug(f"No relevant RAG context found for: {query[:50]}...")
                return None

            context_parts = ["=== Relevant Knowledge Base Context ==="]
            for i, (doc, score) in enumerate(results, 1):
                source = doc.metadata.get("source", "knowledge_base")
                content = doc.page_content[:500]
                if len(doc.page_content) > 500:
                    content += "..."
                context_parts.append(f"\n[{i}] ({source}, relevance: {score:.2f}):\n{content}")

            context = "\n".join(context_parts)
            logger.info(f"✓ Injecting {len(results)} RAG documents into planning context")
            return context

        except Exception as e:
            logger.error(f"Error getting RAG context for planning: {e}")
            return None

    def enrich_query_with_context(self, query: str, k: int = 3) -> str:
        """Enrich a query with relevant RAG context."""
        context = self.get_relevant_context_for_planning(query, k=k)
        if context:
            return f"{context}\n\n=== User Query ===\n{query}"
        return query
