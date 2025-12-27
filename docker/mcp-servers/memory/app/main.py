"""
MCP Server: In-Memory Key-Value Store
Provides persistent (during container lifetime) key-value storage with namespaces
"""

import os
import json
import logging
import time
from typing import Dict, List, Any, Optional
from collections import defaultdict
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="MCP Memory Server")

# Configuration
DEFAULT_TTL = int(os.getenv("DEFAULT_TTL", 3600))  # 1 hour
MAX_KEYS_PER_NAMESPACE = int(os.getenv("MAX_KEYS_PER_NAMESPACE", 10000))
MAX_VALUE_SIZE = int(os.getenv("MAX_VALUE_SIZE", 1048576))  # 1MB


# ============================================
# Data Structures
# ============================================

@dataclass
class MemoryEntry:
    value: Any
    created_at: float
    updated_at: float
    expires_at: Optional[float] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


class MemoryStore:
    def __init__(self):
        self.namespaces: Dict[str, Dict[str, MemoryEntry]] = defaultdict(dict)
        self.locks: Dict[str, bool] = {}
    
    def _cleanup_expired(self, namespace: str):
        """Remove expired entries from namespace."""
        now = time.time()
        ns = self.namespaces.get(namespace, {})
        expired = [k for k, v in ns.items() if v.expires_at and v.expires_at < now]
        for key in expired:
            del ns[key]
    
    def set(
        self, 
        namespace: str, 
        key: str, 
        value: Any, 
        ttl: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Set a key-value pair."""
        self._cleanup_expired(namespace)
        
        if len(self.namespaces[namespace]) >= MAX_KEYS_PER_NAMESPACE:
            raise ValueError(f"Namespace '{namespace}' has reached max keys limit")
        
        value_size = len(json.dumps(value)) if not isinstance(value, str) else len(value)
        if value_size > MAX_VALUE_SIZE:
            raise ValueError(f"Value size exceeds maximum ({MAX_VALUE_SIZE} bytes)")
        
        now = time.time()
        expires_at = now + ttl if ttl else (now + DEFAULT_TTL if DEFAULT_TTL > 0 else None)
        
        self.namespaces[namespace][key] = MemoryEntry(
            value=value,
            created_at=now,
            updated_at=now,
            expires_at=expires_at,
            metadata=metadata or {}
        )
        return True
    
    def get(self, namespace: str, key: str) -> Optional[MemoryEntry]:
        """Get a value by key."""
        self._cleanup_expired(namespace)
        return self.namespaces.get(namespace, {}).get(key)
    
    def delete(self, namespace: str, key: str) -> bool:
        """Delete a key."""
        if namespace in self.namespaces and key in self.namespaces[namespace]:
            del self.namespaces[namespace][key]
            return True
        return False
    
    def list_keys(self, namespace: str, pattern: Optional[str] = None) -> List[str]:
        """List keys in namespace."""
        self._cleanup_expired(namespace)
        keys = list(self.namespaces.get(namespace, {}).keys())
        
        if pattern:
            import fnmatch
            keys = [k for k in keys if fnmatch.fnmatch(k, pattern)]
        
        return keys
    
    def list_namespaces(self) -> List[str]:
        """List all namespaces."""
        return list(self.namespaces.keys())
    
    def clear_namespace(self, namespace: str) -> int:
        """Clear all keys in namespace."""
        count = len(self.namespaces.get(namespace, {}))
        self.namespaces[namespace] = {}
        return count
    
    def stats(self) -> Dict[str, Any]:
        """Get store statistics."""
        total_keys = sum(len(ns) for ns in self.namespaces.values())
        return {
            "namespaces": len(self.namespaces),
            "total_keys": total_keys,
            "namespace_stats": {
                ns: {"keys": len(entries)}
                for ns, entries in self.namespaces.items()
            }
        }


# Global store
store = MemoryStore()


# ============================================
# Models
# ============================================

class SetRequest(BaseModel):
    namespace: str = "default"
    key: str
    value: Any
    ttl: Optional[int] = None
    metadata: Optional[Dict[str, Any]] = None


class GetRequest(BaseModel):
    namespace: str = "default"
    key: str


class DeleteRequest(BaseModel):
    namespace: str = "default"
    key: str


class ListKeysRequest(BaseModel):
    namespace: str = "default"
    pattern: Optional[str] = None


class ClearNamespaceRequest(BaseModel):
    namespace: str


class BatchSetRequest(BaseModel):
    namespace: str = "default"
    items: Dict[str, Any]
    ttl: Optional[int] = None


class BatchGetRequest(BaseModel):
    namespace: str = "default"
    keys: List[str]


# ============================================
# API Endpoints
# ============================================

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    stats = store.stats()
    return {
        "status": "healthy",
        **stats
    }


@app.get("/tools")
async def list_tools():
    """List available tools."""
    return [
        {
            "name": "set",
            "description": "Set a key-value pair in memory",
            "parameters": {
                "namespace": {"type": "string", "description": "Namespace for the key", "default": "default"},
                "key": {"type": "string", "description": "Key name"},
                "value": {"type": "any", "description": "Value to store"},
                "ttl": {"type": "integer", "description": "Time-to-live in seconds"},
                "metadata": {"type": "object", "description": "Optional metadata"}
            }
        },
        {
            "name": "get",
            "description": "Get a value by key",
            "parameters": {
                "namespace": {"type": "string", "description": "Namespace", "default": "default"},
                "key": {"type": "string", "description": "Key name"}
            }
        },
        {
            "name": "delete",
            "description": "Delete a key",
            "parameters": {
                "namespace": {"type": "string", "description": "Namespace", "default": "default"},
                "key": {"type": "string", "description": "Key name"}
            }
        },
        {
            "name": "list_keys",
            "description": "List keys in namespace",
            "parameters": {
                "namespace": {"type": "string", "description": "Namespace", "default": "default"},
                "pattern": {"type": "string", "description": "Glob pattern to filter keys"}
            }
        },
        {
            "name": "list_namespaces",
            "description": "List all namespaces",
            "parameters": {}
        },
        {
            "name": "batch_set",
            "description": "Set multiple key-value pairs",
            "parameters": {
                "namespace": {"type": "string", "description": "Namespace", "default": "default"},
                "items": {"type": "object", "description": "Key-value pairs to set"},
                "ttl": {"type": "integer", "description": "TTL for all items"}
            }
        },
        {
            "name": "batch_get",
            "description": "Get multiple values by keys",
            "parameters": {
                "namespace": {"type": "string", "description": "Namespace", "default": "default"},
                "keys": {"type": "array", "description": "List of keys to get"}
            }
        },
        {
            "name": "clear_namespace",
            "description": "Clear all keys in namespace",
            "parameters": {
                "namespace": {"type": "string", "description": "Namespace to clear"}
            }
        },
        {
            "name": "stats",
            "description": "Get memory store statistics",
            "parameters": {}
        }
    ]


@app.post("/tools/set")
async def set_value(request: SetRequest):
    """Set a key-value pair."""
    try:
        store.set(
            namespace=request.namespace,
            key=request.key,
            value=request.value,
            ttl=request.ttl,
            metadata=request.metadata
        )
        
        logger.info(f"✓ Set {request.namespace}:{request.key}")
        return {
            "success": True,
            "namespace": request.namespace,
            "key": request.key
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Set error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/tools/get")
async def get_value(request: GetRequest):
    """Get a value by key."""
    entry = store.get(request.namespace, request.key)
    
    if entry is None:
        return {
            "found": False,
            "namespace": request.namespace,
            "key": request.key
        }
    
    return {
        "found": True,
        "namespace": request.namespace,
        "key": request.key,
        "value": entry.value,
        "metadata": entry.metadata,
        "created_at": datetime.fromtimestamp(entry.created_at).isoformat(),
        "updated_at": datetime.fromtimestamp(entry.updated_at).isoformat(),
        "expires_at": datetime.fromtimestamp(entry.expires_at).isoformat() if entry.expires_at else None
    }


@app.post("/tools/delete")
async def delete_value(request: DeleteRequest):
    """Delete a key."""
    deleted = store.delete(request.namespace, request.key)
    
    if deleted:
        logger.info(f"✓ Deleted {request.namespace}:{request.key}")
    
    return {
        "deleted": deleted,
        "namespace": request.namespace,
        "key": request.key
    }


@app.post("/tools/list_keys")
async def list_keys(request: ListKeysRequest):
    """List keys in namespace."""
    keys = store.list_keys(request.namespace, request.pattern)
    return {
        "namespace": request.namespace,
        "pattern": request.pattern,
        "keys": keys,
        "count": len(keys)
    }


@app.post("/tools/list_namespaces")
async def list_namespaces():
    """List all namespaces."""
    namespaces = store.list_namespaces()
    return {
        "namespaces": namespaces,
        "count": len(namespaces)
    }


@app.post("/tools/batch_set")
async def batch_set(request: BatchSetRequest):
    """Set multiple key-value pairs."""
    try:
        success_count = 0
        for key, value in request.items.items():
            store.set(
                namespace=request.namespace,
                key=key,
                value=value,
                ttl=request.ttl
            )
            success_count += 1
        
        logger.info(f"✓ Batch set {success_count} keys in {request.namespace}")
        return {
            "success": True,
            "namespace": request.namespace,
            "count": success_count
        }
        
    except Exception as e:
        logger.error(f"Batch set error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/tools/batch_get")
async def batch_get(request: BatchGetRequest):
    """Get multiple values by keys."""
    results = {}
    for key in request.keys:
        entry = store.get(request.namespace, key)
        if entry:
            results[key] = entry.value
    
    return {
        "namespace": request.namespace,
        "results": results,
        "found": len(results),
        "missing": len(request.keys) - len(results)
    }


@app.post("/tools/clear_namespace")
async def clear_namespace(request: ClearNamespaceRequest):
    """Clear all keys in namespace."""
    count = store.clear_namespace(request.namespace)
    
    logger.info(f"✓ Cleared {count} keys from {request.namespace}")
    return {
        "success": True,
        "namespace": request.namespace,
        "deleted_count": count
    }


@app.post("/tools/stats")
async def get_stats():
    """Get memory store statistics."""
    return store.stats()
