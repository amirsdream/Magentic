"""MCP Client for Magentic agents to communicate with MCP Gateway."""

import asyncio
import httpx
import logging
from typing import Dict, List, Any, Optional
from functools import lru_cache

logger = logging.getLogger(__name__)


# Role to MCP server mapping - which servers each role can access
ROLE_SERVER_MAPPING: Dict[str, List[str]] = {
    "researcher": ["websearch", "github", "memory"],
    "coder": ["filesystem", "github", "python", "database"],
    "analyzer": ["websearch", "python", "database", "memory"],
    "writer": ["filesystem", "memory"],
    "retriever": ["filesystem", "database", "memory"],
    "planner": ["websearch", "memory"],
    "critic": ["memory"],
    "synthesizer": ["memory"],
    "coordinator": ["websearch", "filesystem", "github", "memory"],
    "data_engineer": ["database", "filesystem", "python"],
    "debugger": ["python", "filesystem", "github"],
    "tester": ["python", "filesystem"],
}


class MCPClient:
    """Client for agents to interact with centralized MCP Gateway."""

    _instance: Optional["MCPClient"] = None

    def __init__(self, gateway_url: str = "http://localhost:9000"):
        """Initialize MCP client.

        Args:
            gateway_url: URL of the MCP Gateway
        """
        self.gateway_url = gateway_url.rstrip("/")
        self.client: Optional[httpx.AsyncClient] = None
        self._tools_cache: Optional[Dict[str, List[Dict[str, Any]]]] = None
        self._server_health: Dict[str, bool] = {}
        logger.info(f"MCP client configured for gateway: {gateway_url}")

    @classmethod
    def get_instance(cls, gateway_url: str = "http://localhost:9000") -> "MCPClient":
        """Get singleton instance of MCP client.

        Args:
            gateway_url: URL of the MCP Gateway

        Returns:
            MCPClient instance
        """
        if cls._instance is None:
            cls._instance = cls(gateway_url)
        return cls._instance

    @classmethod
    def reset_instance(cls):
        """Reset the singleton instance."""
        cls._instance = None

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create async HTTP client."""
        if self.client is None:
            self.client = httpx.AsyncClient(
                timeout=30.0, limits=httpx.Limits(max_keepalive_connections=5, max_connections=10)
            )
        return self.client

    async def health_check(self, retries: int = 3) -> Dict[str, Any]:
        """Check gateway and server health with retries.

        Args:
            retries: Number of retry attempts

        Returns:
            Health status dictionary
        """
        last_error = None
        url = f"{self.gateway_url}/health"

        for attempt in range(retries):
            try:
                client = await self._get_client()
                logger.debug(f"Health check attempt {attempt + 1}/{retries} to {url}")
                response = await client.get(url, timeout=10.0)
                response.raise_for_status()
                result = response.json()
                logger.info(
                    f"MCP health check successful: {result.get('healthy_servers', 0)}/{result.get('total_servers', 0)} servers"
                )
                return result
            except httpx.ConnectError as e:
                last_error = e
                logger.warning(
                    f"MCP health check attempt {attempt + 1}/{retries}: Connection refused to {url}"
                )
                if attempt < retries - 1:
                    await asyncio.sleep(2)  # Wait before retry
            except httpx.TimeoutException as e:
                last_error = e
                logger.warning(
                    f"MCP health check attempt {attempt + 1}/{retries}: Timeout connecting to {url}"
                )
                if attempt < retries - 1:
                    await asyncio.sleep(2)
            except Exception as e:
                last_error = e
                logger.warning(
                    f"MCP health check attempt {attempt + 1}/{retries}: {type(e).__name__}: {e}"
                )
                if attempt < retries - 1:
                    await asyncio.sleep(2)

        logger.error(f"MCP health check failed after {retries} attempts to {url}: {last_error}")
        return {"status": "unavailable", "error": str(last_error)}

    async def list_servers(self) -> List[Dict[str, Any]]:
        """List all registered MCP servers.

        Returns:
            List of server information
        """
        try:
            client = await self._get_client()
            response = await client.get(f"{self.gateway_url}/servers")
            response.raise_for_status()
            data = response.json()
            return data.get("servers", [])
        except Exception as e:
            logger.error(f"Failed to list servers: {e}")
            return []

    async def discover_tools(self, force_refresh: bool = False) -> Dict[str, List[Dict[str, Any]]]:
        """Discover all available tools from gateway.

        Args:
            force_refresh: Force refresh of cached tools

        Returns:
            Dictionary mapping server names to tool lists
        """
        if self._tools_cache is not None and not force_refresh:
            return self._tools_cache

        try:
            client = await self._get_client()
            response = await client.get(f"{self.gateway_url}/tools")
            response.raise_for_status()

            data = response.json()
            tools_by_server: Dict[str, List[Dict[str, Any]]] = {}

            for tool in data.get("tools", []):
                server = tool.get("server")
                if server not in tools_by_server:
                    tools_by_server[server] = []
                tools_by_server[server].append(tool)

            self._tools_cache = tools_by_server
            logger.info(
                f"Discovered {data.get('total_tools', 0)} tools from {len(tools_by_server)} servers"
            )

            return tools_by_server

        except Exception as e:
            logger.error(f"Failed to discover tools: {e}")
            return {}

    async def execute_tool(self, server: str, tool: str, **params) -> Any:
        """Execute a tool via the gateway.

        Args:
            server: MCP server name
            tool: Tool name
            **params: Tool parameters

        Returns:
            Tool execution result
        """
        try:
            client = await self._get_client()
            response = await client.post(
                f"{self.gateway_url}/execute",
                json={"server": server, "tool": tool, "params": params},
                timeout=60.0,
            )
            response.raise_for_status()

            data = response.json()
            if not data.get("success"):
                raise Exception(f"Tool execution failed: {data}")

            logger.info(f"✓ Executed {server}.{tool}")
            return data.get("result")

        except httpx.HTTPStatusError as e:
            error_msg = f"HTTP {e.response.status_code}: {e.response.text}"
            logger.error(f"Tool execution failed: {error_msg}")
            raise Exception(error_msg)
        except Exception as e:
            logger.error(f"Tool execution failed: {e}")
            raise

    async def get_tools_for_role(self, role: str) -> List[Dict[str, Any]]:
        """Get appropriate tools for an agent role.

        Args:
            role: Agent role name (e.g., 'researcher', 'coder')

        Returns:
            List of tool definitions with server info
        """
        all_tools = await self.discover_tools()

        # Use the global role mapping
        selected_servers = ROLE_SERVER_MAPPING.get(role.lower(), [])
        tools = []

        for server in selected_servers:
            if server in all_tools:
                for tool in all_tools[server]:
                    # Ensure server info is in each tool
                    tool_with_server = {**tool, "server": server}
                    tools.append(tool_with_server)

        logger.info(
            f"Role '{role}' has access to {len(tools)} tools from servers: {selected_servers}"
        )
        return tools

    async def execute_batch(
        self, requests: List[Dict[str, Any]], parallel: bool = True
    ) -> List[Dict[str, Any]]:
        """Execute multiple tools in batch.

        Args:
            requests: List of {"server": str, "tool": str, "params": dict}
            parallel: Execute in parallel (True) or sequential (False)

        Returns:
            List of results
        """
        try:
            client = await self._get_client()
            response = await client.post(
                f"{self.gateway_url}/batch",
                json={"requests": requests, "parallel": parallel},
                timeout=120.0,
            )
            response.raise_for_status()

            data = response.json()
            logger.info(
                f"Batch executed: {data.get('successful', 0)}/{data.get('total', 0)} successful"
            )
            return data.get("results", [])

        except Exception as e:
            logger.error(f"Batch execution failed: {e}")
            return []

    async def get_server_health(self) -> Dict[str, bool]:
        """Get health status of all MCP servers.

        Returns:
            Dict mapping server name to health status
        """
        try:
            health_data = await self.health_check()
            self._server_health = health_data.get("servers", {})
            return self._server_health
        except Exception as e:
            logger.error(f"Failed to get server health: {e}")
            return {}

    async def is_server_healthy(self, server: str) -> bool:
        """Check if a specific server is healthy.

        Args:
            server: Server name

        Returns:
            True if healthy
        """
        if not self._server_health:
            await self.get_server_health()
        return self._server_health.get(server, False)

    async def get_metrics(self) -> Dict[str, Any]:
        """Get gateway metrics.

        Returns:
            Metrics dictionary
        """
        try:
            client = await self._get_client()
            response = await client.get(f"{self.gateway_url}/metrics")
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Failed to get metrics: {e}")
            return {}

    async def close(self):
        """Close the HTTP client."""
        if self.client:
            await self.client.aclose()
            self.client = None
            logger.info("MCP client closed")
