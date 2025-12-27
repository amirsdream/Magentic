"""
MCP Gateway - Centralized MCP Server Registry and Router
Enhanced with metrics, caching, circuit breaker, and batch operations
"""

import asyncio
import logging
import os
import time
from typing import Dict, List, Any, Optional
from contextlib import asynccontextmanager
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
import httpx

# Configure logging
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
logging.basicConfig(
    level=LOG_LEVEL,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


# ============================================
# Configuration
# ============================================

class Config:
    """Gateway configuration."""
    HEALTH_CHECK_INTERVAL = int(os.getenv("HEALTH_CHECK_INTERVAL", 60))
    REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", 30))
    MAX_RETRIES = int(os.getenv("MAX_RETRIES", 3))
    CIRCUIT_BREAKER_THRESHOLD = int(os.getenv("CIRCUIT_BREAKER_THRESHOLD", 5))
    CIRCUIT_BREAKER_TIMEOUT = int(os.getenv("CIRCUIT_BREAKER_TIMEOUT", 60))
    ENABLE_METRICS = os.getenv("ENABLE_METRICS", "true").lower() == "true"
    CACHE_TTL = int(os.getenv("CACHE_TTL", 300))  # 5 minutes


# ============================================
# Models
# ============================================

class MCPToolRequest(BaseModel):
    """Request to execute a tool on an MCP server."""
    server: str
    tool: str
    params: Dict[str, Any] = {}


class MCPBatchRequest(BaseModel):
    """Batch request for multiple tool executions."""
    requests: List[MCPToolRequest]
    parallel: bool = True  # Execute in parallel or sequential


class MCPServerConfig(BaseModel):
    """Configuration for an MCP server."""
    name: str
    url: str
    enabled: bool = True
    capabilities: List[str] = []
    timeout: Optional[int] = None
    priority: int = 0  # Higher priority servers tried first


class CircuitBreakerState(str, Enum):
    CLOSED = "closed"  # Normal operation
    OPEN = "open"      # Blocking requests
    HALF_OPEN = "half_open"  # Testing if service recovered


# ============================================
# Metrics
# ============================================

@dataclass
class ServerMetrics:
    """Metrics for a single server."""
    total_requests: int = 0
    successful_requests: int = 0
    failed_requests: int = 0
    total_latency_ms: float = 0.0
    errors_by_type: Dict[str, int] = field(default_factory=lambda: defaultdict(int))
    last_request_time: Optional[float] = None
    last_error: Optional[str] = None
    
    @property
    def avg_latency_ms(self) -> float:
        if self.successful_requests == 0:
            return 0
        return self.total_latency_ms / self.successful_requests
    
    @property
    def success_rate(self) -> float:
        if self.total_requests == 0:
            return 1.0
        return self.successful_requests / self.total_requests


@dataclass
class CircuitBreaker:
    """Circuit breaker for fault tolerance."""
    state: CircuitBreakerState = CircuitBreakerState.CLOSED
    failure_count: int = 0
    last_failure_time: Optional[float] = None
    last_success_time: Optional[float] = None
    
    def record_success(self):
        self.failure_count = 0
        self.state = CircuitBreakerState.CLOSED
        self.last_success_time = time.time()
    
    def record_failure(self):
        self.failure_count += 1
        self.last_failure_time = time.time()
        
        if self.failure_count >= Config.CIRCUIT_BREAKER_THRESHOLD:
            self.state = CircuitBreakerState.OPEN
            logger.warning(f"Circuit breaker opened after {self.failure_count} failures")
    
    def can_execute(self) -> bool:
        if self.state == CircuitBreakerState.CLOSED:
            return True
        
        if self.state == CircuitBreakerState.OPEN:
            # Check if timeout has passed
            if time.time() - (self.last_failure_time or 0) > Config.CIRCUIT_BREAKER_TIMEOUT:
                self.state = CircuitBreakerState.HALF_OPEN
                return True
            return False
        
        # Half-open: allow one request to test
        return True


# ============================================
# MCP Gateway
# ============================================

class MCPGateway:
    """Central gateway for managing and routing to MCP servers."""
    
    def __init__(self):
        self.servers: Dict[str, MCPServerConfig] = {}
        self.clients: Dict[str, httpx.AsyncClient] = {}
        self.health_status: Dict[str, bool] = {}
        self.tool_cache: Dict[str, List[Dict[str, Any]]] = {}
        self.metrics: Dict[str, ServerMetrics] = defaultdict(ServerMetrics)
        self.circuit_breakers: Dict[str, CircuitBreaker] = defaultdict(CircuitBreaker)
        self._response_cache: Dict[str, tuple] = {}  # (result, timestamp)
        
    async def register_server(self, config: MCPServerConfig):
        """Register a new MCP server."""
        self.servers[config.name] = config
        self.clients[config.name] = httpx.AsyncClient(
            base_url=config.url,
            timeout=config.timeout or Config.REQUEST_TIMEOUT
        )
        logger.info(f"✓ Registered MCP server: {config.name} at {config.url}")
        
        # Initial health check and tool discovery
        await self._health_check(config.name)
        await self._refresh_tools(config.name)
    
    async def unregister_server(self, server_name: str):
        """Unregister an MCP server."""
        if server_name in self.clients:
            await self.clients[server_name].aclose()
            del self.clients[server_name]
        
        for store in [self.servers, self.health_status, self.tool_cache, 
                      self.metrics, self.circuit_breakers]:
            if server_name in store:
                del store[server_name]
        
        logger.info(f"✓ Unregistered MCP server: {server_name}")
    
    async def _health_check(self, server_name: str) -> bool:
        """Check if MCP server is healthy."""
        if server_name not in self.clients:
            return False
            
        try:
            client = self.clients[server_name]
            response = await client.get("/health", timeout=5.0)
            is_healthy = response.status_code == 200
            self.health_status[server_name] = is_healthy
            
            if is_healthy:
                self.circuit_breakers[server_name].record_success()
                logger.debug(f"✓ {server_name} is healthy")
            else:
                self.circuit_breakers[server_name].record_failure()
                logger.warning(f"✗ {server_name} health check failed: {response.status_code}")
                
            return is_healthy
        except Exception as e:
            logger.error(f"✗ {server_name} health check error: {e}")
            self.health_status[server_name] = False
            self.circuit_breakers[server_name].record_failure()
            return False
    
    async def _refresh_tools(self, server_name: str):
        """Fetch and cache available tools from MCP server."""
        if server_name not in self.clients:
            return
            
        try:
            client = self.clients[server_name]
            response = await client.get("/tools", timeout=5.0)
            response.raise_for_status()
            
            tools = response.json()
            self.tool_cache[server_name] = tools
            logger.info(f"✓ Cached {len(tools)} tools from {server_name}")
        except Exception as e:
            logger.error(f"✗ Failed to fetch tools from {server_name}: {e}")
            self.tool_cache[server_name] = []
    
    async def list_all_tools(self) -> Dict[str, List[Dict[str, Any]]]:
        """List all available tools from all registered servers."""
        return {
            server_name: tools
            for server_name, tools in self.tool_cache.items()
            if self.health_status.get(server_name, False)
        }
    
    def _get_cache_key(self, server: str, tool: str, params: Dict) -> str:
        """Generate cache key for request."""
        import hashlib
        import json
        params_str = json.dumps(params, sort_keys=True)
        return hashlib.md5(f"{server}:{tool}:{params_str}".encode()).hexdigest()
    
    def _check_cache(self, cache_key: str) -> Optional[Dict]:
        """Check if result is in cache."""
        if cache_key in self._response_cache:
            result, timestamp = self._response_cache[cache_key]
            if time.time() - timestamp < Config.CACHE_TTL:
                return result
            else:
                del self._response_cache[cache_key]
        return None
    
    def _set_cache(self, cache_key: str, result: Dict):
        """Store result in cache."""
        self._response_cache[cache_key] = (result, time.time())
        
        # Cleanup old cache entries (simple LRU-like)
        if len(self._response_cache) > 1000:
            oldest_keys = sorted(
                self._response_cache.keys(),
                key=lambda k: self._response_cache[k][1]
            )[:100]
            for key in oldest_keys:
                del self._response_cache[key]
    
    async def execute_tool(
        self,
        server: str,
        tool: str,
        params: Dict[str, Any],
        use_cache: bool = False,
        retry_count: int = 0
    ) -> Dict[str, Any]:
        """Execute a tool on specified MCP server."""
        # Validate server exists
        if server not in self.servers:
            raise ValueError(f"Unknown MCP server: {server}")
        
        # Check circuit breaker
        cb = self.circuit_breakers[server]
        if not cb.can_execute():
            raise HTTPException(
                status_code=503,
                detail=f"Server {server} is temporarily unavailable (circuit breaker open)"
            )
        
        # Check cache
        if use_cache:
            cache_key = self._get_cache_key(server, tool, params)
            cached = self._check_cache(cache_key)
            if cached:
                logger.debug(f"Cache hit for {server}.{tool}")
                return cached
        
        # Execute tool
        metrics = self.metrics[server]
        start_time = time.time()
        
        try:
            client = self.clients[server]
            response = await client.post(
                f"/tools/{tool}",
                json=params,
                timeout=Config.REQUEST_TIMEOUT
            )
            response.raise_for_status()
            
            result = response.json()
            
            # Record metrics
            latency = (time.time() - start_time) * 1000
            metrics.total_requests += 1
            metrics.successful_requests += 1
            metrics.total_latency_ms += latency
            metrics.last_request_time = time.time()
            
            # Record circuit breaker success
            cb.record_success()
            
            # Cache result
            if use_cache:
                self._set_cache(cache_key, result)
            
            logger.info(f"✓ Executed {server}.{tool} ({latency:.0f}ms)")
            return result
            
        except httpx.HTTPStatusError as e:
            metrics.total_requests += 1
            metrics.failed_requests += 1
            metrics.errors_by_type[f"HTTP_{e.response.status_code}"] += 1
            metrics.last_error = str(e)
            cb.record_failure()
            
            logger.error(f"✗ HTTP error executing {server}.{tool}: {e.response.status_code}")
            raise HTTPException(
                status_code=e.response.status_code,
                detail=f"MCP server error: {e.response.text}"
            )
        except httpx.TimeoutException:
            metrics.total_requests += 1
            metrics.failed_requests += 1
            metrics.errors_by_type["TIMEOUT"] += 1
            metrics.last_error = "Timeout"
            cb.record_failure()
            
            # Retry on timeout
            if retry_count < Config.MAX_RETRIES:
                logger.warning(f"Timeout on {server}.{tool}, retrying ({retry_count + 1}/{Config.MAX_RETRIES})")
                return await self.execute_tool(server, tool, params, use_cache, retry_count + 1)
            
            raise HTTPException(status_code=504, detail=f"Request timeout for {server}.{tool}")
        except Exception as e:
            metrics.total_requests += 1
            metrics.failed_requests += 1
            metrics.errors_by_type[type(e).__name__] += 1
            metrics.last_error = str(e)
            cb.record_failure()
            
            logger.error(f"✗ Failed to execute {server}.{tool}: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    async def execute_batch(
        self,
        requests: List[MCPToolRequest],
        parallel: bool = True
    ) -> List[Dict[str, Any]]:
        """Execute multiple tool requests."""
        if parallel:
            tasks = [
                self.execute_tool(req.server, req.tool, req.params)
                for req in requests
            ]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            return [
                {"success": True, "result": r} if not isinstance(r, Exception)
                else {"success": False, "error": str(r)}
                for r in results
            ]
        else:
            results = []
            for req in requests:
                try:
                    result = await self.execute_tool(req.server, req.tool, req.params)
                    results.append({"success": True, "result": result})
                except Exception as e:
                    results.append({"success": False, "error": str(e)})
            return results
    
    async def start_health_monitoring(self):
        """Start background health check loop."""
        while True:
            await asyncio.sleep(Config.HEALTH_CHECK_INTERVAL)
            for server_name in list(self.servers.keys()):
                await self._health_check(server_name)
                await self._refresh_tools(server_name)
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get all metrics."""
        return {
            server: {
                "total_requests": m.total_requests,
                "successful_requests": m.successful_requests,
                "failed_requests": m.failed_requests,
                "success_rate": round(m.success_rate, 3),
                "avg_latency_ms": round(m.avg_latency_ms, 2),
                "errors_by_type": dict(m.errors_by_type),
                "last_request_time": datetime.fromtimestamp(m.last_request_time).isoformat() 
                    if m.last_request_time else None,
                "last_error": m.last_error,
                "circuit_breaker_state": self.circuit_breakers[server].state.value
            }
            for server, m in self.metrics.items()
        }
    
    async def close(self):
        """Close all HTTP clients."""
        for client in self.clients.values():
            await client.aclose()


# Global gateway instance
gateway = MCPGateway()


# ============================================
# FastAPI Application
# ============================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown lifecycle."""
    # Startup: Register MCP servers from environment
    await register_servers_from_env()
    
    # Start health monitoring
    asyncio.create_task(gateway.start_health_monitoring())
    
    logger.info("🚀 MCP Gateway started (Enhanced)")
    
    yield
    
    # Shutdown: Close clients
    await gateway.close()
    logger.info("👋 MCP Gateway stopped")


app = FastAPI(
    title="MCP Gateway",
    description="Enhanced Centralized MCP Server Registry and Router",
    version="2.0.0",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request timing middleware
@app.middleware("http")
async def add_timing_header(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    duration = time.time() - start
    response.headers["X-Response-Time"] = f"{duration*1000:.2f}ms"
    return response


async def register_servers_from_env():
    """Register MCP servers from environment variables."""
    servers = []
    
    # Filesystem server
    if fs_url := os.getenv("MCP_FILESYSTEM_URL"):
        servers.append(MCPServerConfig(
            name="filesystem",
            url=fs_url,
            capabilities=["read_file", "write_file", "list_files", "delete_file"]
        ))
    
    # Web search server
    if ws_url := os.getenv("MCP_WEBSEARCH_URL"):
        servers.append(MCPServerConfig(
            name="websearch",
            url=ws_url,
            capabilities=["search", "search_news"]
        ))
    
    # GitHub server
    if gh_url := os.getenv("MCP_GITHUB_URL"):
        servers.append(MCPServerConfig(
            name="github",
            url=gh_url,
            capabilities=["search_repos", "get_repo", "list_issues"]
        ))
    
    # Python execution server
    if py_url := os.getenv("MCP_PYTHON_URL"):
        servers.append(MCPServerConfig(
            name="python",
            url=py_url,
            capabilities=["execute_python", "validate_syntax"]
        ))
    
    # Database server
    if db_url := os.getenv("MCP_DATABASE_URL"):
        servers.append(MCPServerConfig(
            name="database",
            url=db_url,
            capabilities=["query", "execute", "list_tables", "create_table"]
        ))
    
    # Memory server
    if mem_url := os.getenv("MCP_MEMORY_URL"):
        servers.append(MCPServerConfig(
            name="memory",
            url=mem_url,
            capabilities=["set", "get", "delete", "list_keys", "batch_set", "batch_get"]
        ))
    
    # Register all servers
    for config in servers:
        try:
            await gateway.register_server(config)
        except Exception as e:
            logger.error(f"Failed to register {config.name}: {e}")


# ============================================
# API Endpoints
# ============================================

@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "name": "MCP Gateway",
        "version": "2.0.0",
        "description": "Enhanced Centralized MCP Server Registry and Router",
        "features": [
            "Circuit breaker pattern",
            "Request metrics",
            "Response caching",
            "Batch operations",
            "Automatic retries"
        ],
        "endpoints": {
            "health": "/health",
            "servers": "/servers",
            "tools": "/tools",
            "execute": "/execute",
            "batch": "/batch",
            "metrics": "/metrics"
        }
    }


@app.get("/health")
async def health_check():
    """Gateway and server health check."""
    return {
        "status": "healthy",
        "servers": gateway.health_status,
        "total_servers": len(gateway.servers),
        "healthy_servers": sum(1 for status in gateway.health_status.values() if status),
        "circuit_breakers": {
            name: cb.state.value 
            for name, cb in gateway.circuit_breakers.items()
        }
    }


@app.get("/servers")
async def list_servers():
    """List all registered MCP servers."""
    return {
        "servers": [
            {
                "name": name,
                "url": config.url,
                "enabled": config.enabled,
                "healthy": gateway.health_status.get(name, False),
                "capabilities": config.capabilities,
                "tools_count": len(gateway.tool_cache.get(name, [])),
                "circuit_breaker": gateway.circuit_breakers[name].state.value
            }
            for name, config in gateway.servers.items()
        ]
    }


@app.get("/tools")
async def list_tools():
    """List all available tools from all servers."""
    tools = await gateway.list_all_tools()
    
    # Flatten into single list with server prefix
    all_tools = []
    for server_name, server_tools in tools.items():
        for tool in server_tools:
            all_tools.append({
                "server": server_name,
                "name": tool.get("name"),
                "description": tool.get("description"),
                "parameters": tool.get("parameters", {})
            })
    
    return {
        "total_tools": len(all_tools),
        "tools": all_tools,
        "by_server": {
            server: len(tools) 
            for server, tools in gateway.tool_cache.items()
        }
    }


class ExecuteRequest(BaseModel):
    """Execute tool request with optional caching."""
    server: str
    tool: str
    params: Dict[str, Any] = {}
    use_cache: bool = False


@app.post("/execute")
async def execute_tool(request: ExecuteRequest):
    """Execute a tool on specified MCP server."""
    try:
        result = await gateway.execute_tool(
            server=request.server,
            tool=request.tool,
            params=request.params,
            use_cache=request.use_cache
        )
        return {"success": True, "result": result}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/batch")
async def execute_batch(request: MCPBatchRequest):
    """Execute multiple tools in batch."""
    try:
        results = await gateway.execute_batch(
            requests=request.requests,
            parallel=request.parallel
        )
        
        success_count = sum(1 for r in results if r.get("success"))
        return {
            "total": len(results),
            "successful": success_count,
            "failed": len(results) - success_count,
            "results": results
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/metrics")
async def get_metrics():
    """Get gateway and server metrics."""
    if not Config.ENABLE_METRICS:
        raise HTTPException(status_code=404, detail="Metrics disabled")
    
    return {
        "gateway": {
            "registered_servers": len(gateway.servers),
            "healthy_servers": sum(1 for s in gateway.health_status.values() if s),
            "cached_responses": len(gateway._response_cache)
        },
        "servers": gateway.get_metrics()
    }


@app.post("/servers/register")
async def register_server(config: MCPServerConfig):
    """Dynamically register a new MCP server."""
    try:
        await gateway.register_server(config)
        return {"success": True, "message": f"Registered {config.name}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/servers/{server_name}")
async def unregister_server(server_name: str):
    """Unregister an MCP server."""
    if server_name not in gateway.servers:
        raise HTTPException(status_code=404, detail=f"Server {server_name} not found")
    
    await gateway.unregister_server(server_name)
    return {"success": True, "message": f"Unregistered {server_name}"}


@app.post("/servers/{server_name}/health")
async def check_server_health(server_name: str):
    """Manually trigger health check for a server."""
    if server_name not in gateway.servers:
        raise HTTPException(status_code=404, detail=f"Server {server_name} not found")
    
    is_healthy = await gateway._health_check(server_name)
    await gateway._refresh_tools(server_name)
    
    return {
        "server": server_name,
        "healthy": is_healthy,
        "tools_count": len(gateway.tool_cache.get(server_name, []))
    }


@app.post("/cache/clear")
async def clear_cache():
    """Clear response cache."""
    count = len(gateway._response_cache)
    gateway._response_cache.clear()
    return {"cleared": count}
