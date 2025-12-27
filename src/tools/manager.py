"""Tool manager for agent capabilities."""

import logging
from typing import TYPE_CHECKING, List, Optional, Dict

from langchain_core.tools import BaseTool, tool
from langchain_community.tools import DuckDuckGoSearchRun

from .mcp import create_mcp_tools, create_mcp_tools_for_role, get_mcp_tool_names

if TYPE_CHECKING:
    from ..services.rag import RAGService
    from ..services.mcp_client import MCPClient

logger = logging.getLogger(__name__)


class ToolManager:
    """Manager for agent tools with MCP gateway integration."""

    def __init__(
        self, 
        rag_service: Optional["RAGService"] = None, 
        mcp_client: Optional["MCPClient"] = None
    ):
        """Initialize tool manager.
        
        Args:
            rag_service: Optional RAG service instance
            mcp_client: Optional MCP client instance for gateway access
        """
        self.tools: List[BaseTool] = []
        self.rag_service = rag_service
        self.mcp_client = mcp_client
        self._role_tools_cache: Dict[str, List[BaseTool]] = {}
        self._all_mcp_tools: List[BaseTool] = []

    async def initialize_tools(self) -> List[BaseTool]:
        """Initialize and return all available tools.
        
        Returns:
            List of initialized tools.
        """
        try:
            # Add MCP tools if client is available (preferred)
            if self.mcp_client:
                self._all_mcp_tools = await create_mcp_tools(self.mcp_client)
                self.tools.extend(self._all_mcp_tools)
                logger.info(f"Added {len(self._all_mcp_tools)} MCP tools (includes SearXNG search)")
            else:
                # Fallback to DuckDuckGo when MCP not available
                search = DuckDuckGoSearchRun()
                self.tools.append(search)
                logger.info("Added DuckDuckGo search (MCP not available)")
            
            # Add RAG tool if service is available
            if self.rag_service:
                rag_tool = self._create_rag_tool()
                self.tools.append(rag_tool)
                logger.info("Added RAG retrieval tool")
            
            logger.info(f"Initialized {len(self.tools)} tool(s)")
            return self.tools
            
        except Exception as e:
            logger.error(f"Failed to initialize tools: {e}")
            raise
    
    async def get_tools_for_role(self, role: str) -> List[BaseTool]:
        """Get tools appropriate for a specific agent role.
        
        This method returns role-specific MCP tools plus base tools.
        Results are cached for performance.
        
        Args:
            role: Agent role name (e.g., 'researcher', 'coder')
            
        Returns:
            List of tools appropriate for the role
        """
        # Check cache first
        if role in self._role_tools_cache:
            return self._role_tools_cache[role]
        
        role_tools: List[BaseTool] = []
        
        # Add role-specific MCP tools (preferred - includes SearXNG search)
        if self.mcp_client:
            try:
                mcp_role_tools = await create_mcp_tools_for_role(self.mcp_client, role)
                role_tools.extend(mcp_role_tools)
                logger.info(f"Role '{role}' has {len(mcp_role_tools)} MCP tools (SearXNG search included)")
            except Exception as e:
                logger.warning(f"Failed to get MCP tools for role {role}: {e}")
                # Fallback to DuckDuckGo on MCP failure
                role_tools.append(DuckDuckGoSearchRun())
                logger.info(f"Role '{role}' using DuckDuckGo fallback")
        else:
            # No MCP - use DuckDuckGo
            role_tools.append(DuckDuckGoSearchRun())
            logger.info(f"Role '{role}' using DuckDuckGo (MCP not available)")
        
        # Add RAG tool if available
        if self.rag_service:
            role_tools.append(self._create_rag_tool())
        
        # Cache the result
        self._role_tools_cache[role] = role_tools
        return role_tools
    
    def clear_role_cache(self):
        """Clear the role tools cache."""
        self._role_tools_cache.clear()
        logger.info("Cleared role tools cache")
    
    def _create_rag_tool(self) -> BaseTool:
        """Create RAG retrieval tool.
        
        Returns:
            RAG tool
        """
        rag_service = self.rag_service
        
        @tool
        def search_knowledge_base(query: str) -> str:
            """Search the knowledge base for relevant information.
            
            Args:
                query: Search query
                
            Returns:
                Relevant context from knowledge base
            """
            try:
                if rag_service is None:
                    return "Knowledge base not available."
                    
                context = rag_service.get_context(query, k=4)
                if context:
                    return f"Knowledge base results:\n{context}"
                else:
                    return "No relevant information found in knowledge base."
            except Exception as e:
                logger.error(f"RAG search failed: {e}")
                return f"Error searching knowledge base: {e}"
        
        return search_knowledge_base

    def get_tool_names(self) -> List[str]:
        """Get names of all initialized tools.
        
        Returns:
            List of tool names.
        """
        return [tool.name for tool in self.tools]
    
    def get_mcp_tool_names(self) -> List[str]:
        """Get names of MCP tools only.
        
        Returns:
            List of MCP tool names.
        """
        return get_mcp_tool_names(self.tools)
    
    def has_mcp_tools(self) -> bool:
        """Check if MCP tools are available.
        
        Returns:
            True if MCP tools are loaded.
        """
        return len(self._all_mcp_tools) > 0
