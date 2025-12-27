"""MCP (Model Context Protocol) integration service."""

import logging
import httpx
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)


class MCPService:
    """Service for interacting with MCP servers."""

    def __init__(self, server_url: Optional[str] = None):
        """Initialize MCP service.

        Args:
            server_url: Base URL of the MCP server
        """
        self.server_url = server_url
        self.client = httpx.AsyncClient(timeout=30.0) if server_url else None

        if server_url:
            logger.info(f"MCP service initialized with server: {server_url}")
        else:
            logger.info("MCP service initialized without server (disabled)")

    async def list_tools(self) -> List[Dict[str, Any]]:
        """List available tools from MCP server.

        Returns:
            List of tool definitions
        """
        if not self.client or not self.server_url:
            logger.warning("MCP not configured")
            return []

        try:
            response = await self.client.get(f"{self.server_url}/tools")
            response.raise_for_status()
            tools = response.json()
            logger.info(f"Retrieved {len(tools)} tools from MCP server")
            return tools
        except Exception as e:
            logger.error(f"Failed to list MCP tools: {e}")
            return []

    async def call_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Call a tool on the MCP server.

        Args:
            tool_name: Name of the tool to call
            arguments: Tool arguments

        Returns:
            Tool response
        """
        if not self.client or not self.server_url:
            logger.warning("MCP not configured")
            return {"error": "MCP not configured"}

        try:
            response = await self.client.post(
                f"{self.server_url}/tools/{tool_name}", json=arguments
            )
            response.raise_for_status()
            result = response.json()
            logger.info(f"✓ Called MCP tool: {tool_name}")
            return result
        except Exception as e:
            logger.error(f"Failed to call MCP tool {tool_name}: {e}")
            return {"error": str(e)}

    async def get_context(self, query: str) -> str:
        """Get context from MCP server.

        Args:
            query: Query to get context for

        Returns:
            Context string
        """
        if not self.client or not self.server_url:
            return ""

        try:
            response = await self.client.post(f"{self.server_url}/context", json={"query": query})
            response.raise_for_status()
            data = response.json()
            return data.get("context", "")
        except Exception as e:
            logger.error(f"Failed to get MCP context: {e}")
            return ""

    async def close(self):
        """Close the HTTP client."""
        if self.client:
            await self.client.aclose()

    def __del__(self):
        """Cleanup on deletion."""
        if self.client and not self.client.is_closed:
            try:
                import asyncio

                loop = asyncio.get_event_loop()
                if loop.is_running():
                    loop.create_task(self.close())
                else:
                    loop.run_until_complete(self.close())
            except Exception:
                pass
