"""Artifact service for storing and retrieving agent-created files."""

import logging
from datetime import datetime
from typing import Optional, List, Dict, Any
from pathlib import Path

from sqlalchemy.orm import Session

from .database import SessionLocal, Artifact

logger = logging.getLogger(__name__)


class ArtifactService:
    """Service for managing artifacts in the database."""

    @staticmethod
    def save_artifact(
        session_id: str,
        agent_id: str,
        name: str,
        path: str,
        content: str,
        language: Optional[str] = None,
        chat_session_id: Optional[int] = None,
        message_id: Optional[int] = None,
    ) -> Artifact:
        """Save an artifact to the database.
        
        Args:
            session_id: Execution session ID (e.g., session_20251229_143015)
            agent_id: Agent that created the artifact
            name: File name
            path: Original path in workspace
            content: File content
            language: Programming language (optional)
            chat_session_id: Chat session ID for linking (optional)
            message_id: Chat message ID for linking (optional)
            
        Returns:
            Created Artifact record
        """
        db = SessionLocal()
        try:
            artifact = Artifact(
                session_id=session_id,
                agent_id=agent_id,
                name=name,
                path=path,
                content=content,
                language=language,
                size=len(content) if content else 0,
                chat_session_id=chat_session_id,
                message_id=message_id,
                created_at=datetime.utcnow(),
            )
            db.add(artifact)
            db.commit()
            db.refresh(artifact)
            logger.info(f"Saved artifact {name} for session {session_id}")
            return artifact
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to save artifact: {e}")
            raise
        finally:
            db.close()

    @staticmethod
    def get_artifact_by_path(session_id: str, path: str) -> Optional[Artifact]:
        """Get artifact by session and path.
        
        Args:
            session_id: Execution session ID
            path: File path
            
        Returns:
            Artifact if found, None otherwise
        """
        db = SessionLocal()
        try:
            return db.query(Artifact).filter(
                Artifact.session_id == session_id,
                Artifact.path == path
            ).first()
        finally:
            db.close()

    @staticmethod
    def get_artifacts_by_session(session_id: str) -> List[Artifact]:
        """Get all artifacts for a session.
        
        Args:
            session_id: Execution session ID
            
        Returns:
            List of artifacts
        """
        db = SessionLocal()
        try:
            return db.query(Artifact).filter(
                Artifact.session_id == session_id
            ).order_by(Artifact.created_at).all()
        finally:
            db.close()

    @staticmethod
    def get_artifacts_by_chat_session(chat_session_id: int) -> List[Artifact]:
        """Get all artifacts for a chat session.
        
        Args:
            chat_session_id: Chat session ID
            
        Returns:
            List of artifacts
        """
        db = SessionLocal()
        try:
            return db.query(Artifact).filter(
                Artifact.chat_session_id == chat_session_id
            ).order_by(Artifact.created_at).all()
        finally:
            db.close()

    @staticmethod
    def get_artifact_content(artifact_id: int) -> Optional[str]:
        """Get artifact content by ID.
        
        Args:
            artifact_id: Artifact ID
            
        Returns:
            Content string if found, None otherwise
        """
        db = SessionLocal()
        try:
            artifact = db.query(Artifact).filter(Artifact.id == artifact_id).first()
            if artifact is not None and artifact.content is not None:
                return str(artifact.content)
            return None
        finally:
            db.close()

    @staticmethod
    def link_to_message(session_id: str, chat_session_id: int, message_id: int) -> int:
        """Link all artifacts from a session to a chat message.
        
        Args:
            session_id: Execution session ID
            chat_session_id: Chat session ID
            message_id: Chat message ID
            
        Returns:
            Number of artifacts updated
        """
        db = SessionLocal()
        try:
            updated = db.query(Artifact).filter(
                Artifact.session_id == session_id
            ).update({
                "chat_session_id": chat_session_id,
                "message_id": message_id
            })
            db.commit()
            logger.info(f"Linked {updated} artifacts to message {message_id}")
            return updated
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to link artifacts: {e}")
            raise
        finally:
            db.close()

    @staticmethod
    def to_dict(artifact: Artifact) -> Dict[str, Any]:
        """Convert artifact to dictionary."""
        created_at = artifact.created_at
        return {
            "id": artifact.id,
            "session_id": artifact.session_id,
            "agent_id": artifact.agent_id,
            "name": artifact.name,
            "path": artifact.path,
            "language": artifact.language,
            "size": artifact.size,
            "created_at": created_at.isoformat() if created_at is not None else None,  # type: ignore
        }
