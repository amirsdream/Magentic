"""
MCP Server: Python Code Execution
Provides sandboxed Python code execution capabilities
"""

import os
import sys
import io
import logging
import traceback
import time
from typing import Dict, Any, Optional
from contextlib import redirect_stdout, redirect_stderr
import multiprocessing
from multiprocessing import Process, Queue

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="MCP Python Execution Server")

# Configuration
MAX_EXECUTION_TIME = int(os.getenv("MAX_EXECUTION_TIME", 30))  # seconds
MAX_MEMORY_MB = int(os.getenv("MAX_MEMORY_MB", 256))
MAX_OUTPUT_SIZE = int(os.getenv("MAX_OUTPUT_SIZE", 65536))  # bytes


# ============================================
# Models
# ============================================

class ExecuteCodeRequest(BaseModel):
    code: str
    timeout: Optional[int] = None
    globals_dict: Optional[Dict[str, Any]] = None


class ValidateSyntaxRequest(BaseModel):
    code: str


# ============================================
# Sandboxed Execution
# ============================================

# Safe builtins for sandboxed execution
SAFE_BUILTINS = {
    'abs': abs, 'all': all, 'any': any, 'ascii': ascii,
    'bin': bin, 'bool': bool, 'bytearray': bytearray, 'bytes': bytes,
    'callable': callable, 'chr': chr, 'complex': complex,
    'dict': dict, 'divmod': divmod, 'enumerate': enumerate,
    'filter': filter, 'float': float, 'format': format,
    'frozenset': frozenset, 'getattr': getattr, 'hasattr': hasattr,
    'hash': hash, 'hex': hex, 'int': int, 'isinstance': isinstance,
    'issubclass': issubclass, 'iter': iter, 'len': len, 'list': list,
    'map': map, 'max': max, 'min': min, 'next': next,
    'object': object, 'oct': oct, 'ord': ord, 'pow': pow,
    'print': print, 'range': range, 'repr': repr, 'reversed': reversed,
    'round': round, 'set': set, 'slice': slice, 'sorted': sorted,
    'str': str, 'sum': sum, 'tuple': tuple, 'type': type,
    'zip': zip, 'True': True, 'False': False, 'None': None,
    'Exception': Exception, 'ValueError': ValueError, 'TypeError': TypeError,
    'KeyError': KeyError, 'IndexError': IndexError, 'RuntimeError': RuntimeError,
}

# Safe modules that can be imported
SAFE_MODULES = {
    'math', 'random', 'datetime', 'json', 'collections',
    'itertools', 'functools', 're', 'string', 'statistics',
    'decimal', 'fractions', 'operator', 'textwrap', 'unicodedata',
    'heapq', 'bisect', 'copy', 'pprint', 'enum',
}


def safe_import(name, globals_dict=None, locals_dict=None, fromlist=(), level=0):
    """Restricted import that only allows safe modules."""
    base_module = name.split('.')[0]
    if base_module not in SAFE_MODULES:
        raise ImportError(f"Import of '{name}' is not allowed in sandbox")
    return __builtins__['__import__'](name, globals_dict, locals_dict, fromlist, level)


def execute_in_sandbox(code: str, result_queue: Queue, timeout: int, globals_dict: dict):
    """Execute code in a sandboxed subprocess."""
    stdout_capture = io.StringIO()
    stderr_capture = io.StringIO()
    
    try:
        # Set up restricted globals
        restricted_globals = {
            '__builtins__': {**SAFE_BUILTINS, '__import__': safe_import},
            '__name__': '__main__',
            **(globals_dict or {})
        }
        
        with redirect_stdout(stdout_capture), redirect_stderr(stderr_capture):
            exec(compile(code, '<sandbox>', 'exec'), restricted_globals)
        
        # Get the result (last expression if available)
        result = restricted_globals.get('result', restricted_globals.get('output', None))
        
        result_queue.put({
            'success': True,
            'stdout': stdout_capture.getvalue()[:MAX_OUTPUT_SIZE],
            'stderr': stderr_capture.getvalue()[:MAX_OUTPUT_SIZE],
            'result': result if isinstance(result, (str, int, float, list, dict, bool, type(None))) else str(result)
        })
        
    except Exception as e:
        result_queue.put({
            'success': False,
            'stdout': stdout_capture.getvalue()[:MAX_OUTPUT_SIZE],
            'stderr': stderr_capture.getvalue()[:MAX_OUTPUT_SIZE],
            'error': str(e),
            'traceback': traceback.format_exc()
        })


# ============================================
# API Endpoints
# ============================================

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "max_execution_time": MAX_EXECUTION_TIME,
        "max_memory_mb": MAX_MEMORY_MB,
        "safe_modules": list(SAFE_MODULES)
    }


@app.get("/tools")
async def list_tools():
    """List available tools."""
    return [
        {
            "name": "execute_python",
            "description": "Execute Python code in a sandboxed environment",
            "parameters": {
                "code": {"type": "string", "description": "Python code to execute"},
                "timeout": {"type": "integer", "description": "Execution timeout in seconds", "default": 30},
                "globals_dict": {"type": "object", "description": "Variables to inject into the execution context"}
            }
        },
        {
            "name": "validate_syntax",
            "description": "Validate Python syntax without executing",
            "parameters": {
                "code": {"type": "string", "description": "Python code to validate"}
            }
        }
    ]


@app.post("/tools/execute_python")
async def execute_python(request: ExecuteCodeRequest):
    """Execute Python code in sandbox."""
    try:
        timeout = min(request.timeout or MAX_EXECUTION_TIME, MAX_EXECUTION_TIME)
        
        # Create result queue and process
        result_queue = Queue()
        process = Process(
            target=execute_in_sandbox,
            args=(request.code, result_queue, timeout, request.globals_dict or {})
        )
        
        start_time = time.time()
        process.start()
        process.join(timeout=timeout)
        
        if process.is_alive():
            process.terminate()
            process.join(timeout=1)
            if process.is_alive():
                process.kill()
            
            return {
                "success": False,
                "error": f"Execution timed out after {timeout} seconds",
                "execution_time": timeout
            }
        
        execution_time = time.time() - start_time
        
        if result_queue.empty():
            return {
                "success": False,
                "error": "No result returned from execution",
                "execution_time": execution_time
            }
        
        result = result_queue.get_nowait()
        result["execution_time"] = round(execution_time, 3)
        
        logger.info(f"✓ Code executed in {execution_time:.3f}s")
        return result
        
    except Exception as e:
        logger.error(f"Execution error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/tools/validate_syntax")
async def validate_syntax(request: ValidateSyntaxRequest):
    """Validate Python syntax without executing."""
    try:
        compile(request.code, '<validate>', 'exec')
        return {
            "valid": True,
            "message": "Syntax is valid"
        }
    except SyntaxError as e:
        return {
            "valid": False,
            "error": str(e),
            "line": e.lineno,
            "offset": e.offset,
            "text": e.text
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
