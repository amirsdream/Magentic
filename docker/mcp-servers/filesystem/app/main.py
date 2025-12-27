"""
MCP Server: Filesystem Operations
Provides file read/write/list operations
"""

import os
import logging
from pathlib import Path
from typing import List, Dict, Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import aiofiles

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="MCP Filesystem Server")

# Configuration
WORKSPACE_DIR = Path(os.getenv("WORKSPACE_DIR", "/workspace"))
MAX_FILE_SIZE = int(os.getenv("MAX_FILE_SIZE", 10485760))  # 10MB default


# ============================================
# Models
# ============================================

class FileReadRequest(BaseModel):
    path: str


class FileWriteRequest(BaseModel):
    path: str
    content: str


class FileDeleteRequest(BaseModel):
    path: str


class DirectoryListRequest(BaseModel):
    path: str = "."


# ============================================
# Helper Functions
# ============================================

def get_safe_path(relative_path: str) -> Path:
    """Get safe absolute path within workspace."""
    full_path = (WORKSPACE_DIR / relative_path).resolve()
    
    # Ensure path is within workspace
    if not str(full_path).startswith(str(WORKSPACE_DIR)):
        raise ValueError("Path is outside workspace")
    
    return full_path


# ============================================
# API Endpoints
# ============================================

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "workspace": str(WORKSPACE_DIR),
        "workspace_exists": WORKSPACE_DIR.exists()
    }


@app.get("/tools")
async def list_tools():
    """List available tools."""
    return [
        {
            "name": "read_file",
            "description": "Read contents of a file",
            "parameters": {
                "path": {"type": "string", "description": "Relative path to file"}
            }
        },
        {
            "name": "write_file",
            "description": "Write content to a file",
            "parameters": {
                "path": {"type": "string", "description": "Relative path to file"},
                "content": {"type": "string", "description": "Content to write"}
            }
        },
        {
            "name": "list_files",
            "description": "List files in a directory",
            "parameters": {
                "path": {"type": "string", "description": "Relative path to directory", "default": "."}
            }
        },
        {
            "name": "delete_file",
            "description": "Delete a file",
            "parameters": {
                "path": {"type": "string", "description": "Relative path to file"}
            }
        }
    ]


@app.post("/tools/read_file")
async def read_file(request: FileReadRequest):
    """Read a file from workspace."""
    try:
        file_path = get_safe_path(request.path)
        
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="File not found")
        
        if not file_path.is_file():
            raise HTTPException(status_code=400, detail="Path is not a file")
        
        # Check file size
        if file_path.stat().st_size > MAX_FILE_SIZE:
            raise HTTPException(status_code=413, detail="File too large")
        
        async with aiofiles.open(file_path, 'r', encoding='utf-8') as f:
            content = await f.read()
        
        logger.info(f"✓ Read file: {request.path}")
        return {
            "path": request.path,
            "content": content,
            "size": len(content)
        }
        
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.error(f"Error reading file: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/tools/write_file")
async def write_file(request: FileWriteRequest):
    """Write content to a file."""
    try:
        file_path = get_safe_path(request.path)
        
        # Create parent directories if needed
        file_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Check content size
        if len(request.content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=413, detail="Content too large")
        
        async with aiofiles.open(file_path, 'w', encoding='utf-8') as f:
            await f.write(request.content)
        
        logger.info(f"✓ Wrote file: {request.path}")
        return {
            "path": request.path,
            "size": len(request.content),
            "success": True
        }
        
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.error(f"Error writing file: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/tools/list_files")
async def list_files(request: DirectoryListRequest):
    """List files in a directory."""
    try:
        dir_path = get_safe_path(request.path)
        
        if not dir_path.exists():
            raise HTTPException(status_code=404, detail="Directory not found")
        
        if not dir_path.is_dir():
            raise HTTPException(status_code=400, detail="Path is not a directory")
        
        files = []
        for item in dir_path.iterdir():
            files.append({
                "name": item.name,
                "path": str(item.relative_to(WORKSPACE_DIR)),
                "type": "directory" if item.is_dir() else "file",
                "size": item.stat().st_size if item.is_file() else None
            })
        
        logger.info(f"✓ Listed directory: {request.path}")
        return {
            "path": request.path,
            "files": sorted(files, key=lambda x: (x["type"] != "directory", x["name"]))
        }
        
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.error(f"Error listing directory: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/tools/delete_file")
async def delete_file(request: FileDeleteRequest):
    """Delete a file."""
    try:
        file_path = get_safe_path(request.path)
        
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="File not found")
        
        if file_path.is_dir():
            raise HTTPException(status_code=400, detail="Cannot delete directory")
        
        file_path.unlink()
        
        logger.info(f"✓ Deleted file: {request.path}")
        return {
            "path": request.path,
            "success": True
        }
        
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.error(f"Error deleting file: {e}")
        raise HTTPException(status_code=500, detail=str(e))
