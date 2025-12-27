"""MCP tool creation utilities."""

import asyncio
import logging
from typing import TYPE_CHECKING, List, Dict, Any, Optional

from langchain_core.tools import BaseTool, StructuredTool
from pydantic import BaseModel, Field, create_model

if TYPE_CHECKING:
    from ..services.mcp_client import MCPClient

logger = logging.getLogger(__name__)


def _create_tool_input_model(tool_name: str, parameters: Dict[str, Any]) -> type:
    """Create a Pydantic model for tool input parameters.

    Args:
        tool_name: Name of the tool
        parameters: Parameter definitions from MCP

    Returns:
        Pydantic model class
    """
    fields = {}
    for param_name, param_info in parameters.items():
        param_type = param_info.get("type", "string")
        description = param_info.get("description", "")
        default = param_info.get("default", ...)

        # Map MCP types to Python types
        type_mapping = {
            "string": str,
            "integer": int,
            "number": float,
            "boolean": bool,
            "array": list,
            "object": dict,
            "any": Any,
        }
        python_type = type_mapping.get(param_type, str)

        # Handle optional parameters
        if default != ...:
            fields[param_name] = (
                Optional[python_type],
                Field(default=default, description=description),
            )
        else:
            fields[param_name] = (python_type, Field(description=description))

    # Create dynamic model
    model_name = f"{tool_name.title().replace('_', '')}Input"
    return create_model(model_name, **fields)  # type: ignore


async def create_mcp_tools(mcp_client: "MCPClient") -> List[BaseTool]:
    """Create tools from MCP Gateway.

    Args:
        mcp_client: MCP client instance

    Returns:
        List of MCP-based LangChain tools
    """
    try:
        # Discover available tools from MCP Gateway
        tools_by_server = await mcp_client.discover_tools()
        mcp_tools: List[BaseTool] = []

        # Create a LangChain tool for each MCP tool
        for server_name, server_tools in tools_by_server.items():
            for tool_info in server_tools:
                tool_name = tool_info.get("name")
                tool_desc = tool_info.get("description", "No description")
                parameters = tool_info.get("parameters", {})

                if not tool_name:
                    continue

                # Create unique tool name with server prefix
                full_tool_name = f"mcp_{server_name}_{tool_name}"
                full_description = f"[MCP:{server_name}] {tool_desc}"

                # Create the tool
                tool = _create_mcp_tool(
                    mcp_client=mcp_client,
                    server=server_name,
                    tool_name=tool_name,
                    full_name=full_tool_name,
                    description=full_description,
                    parameters=parameters,
                )

                if tool:
                    mcp_tools.append(tool)
                    logger.debug(f"Created MCP tool: {full_tool_name}")

        logger.info(f"Created {len(mcp_tools)} MCP tools from {len(tools_by_server)} servers")
        return mcp_tools

    except Exception as e:
        logger.error(f"Failed to create MCP tools: {e}")
        return []


async def create_mcp_tools_for_role(mcp_client: "MCPClient", role: str) -> List[BaseTool]:
    """Create MCP tools specific to an agent role.

    Args:
        mcp_client: MCP client instance
        role: Agent role name

    Returns:
        List of role-specific MCP tools
    """
    try:
        # Get tools for this role
        role_tools = await mcp_client.get_tools_for_role(role)
        mcp_tools: List[BaseTool] = []

        for tool_info in role_tools:
            server_name = tool_info.get("server")
            tool_name = tool_info.get("name")
            tool_desc = tool_info.get("description", "No description")
            parameters = tool_info.get("parameters", {})

            if not tool_name or not server_name:
                continue

            # Create unique tool name
            full_tool_name = f"mcp_{server_name}_{tool_name}"
            full_description = f"[MCP:{server_name}] {tool_desc}"

            tool = _create_mcp_tool(
                mcp_client=mcp_client,
                server=server_name,
                tool_name=tool_name,
                full_name=full_tool_name,
                description=full_description,
                parameters=parameters,
            )

            if tool:
                mcp_tools.append(tool)

        logger.info(f"Created {len(mcp_tools)} MCP tools for role '{role}'")
        return mcp_tools

    except Exception as e:
        logger.error(f"Failed to create MCP tools for role {role}: {e}")
        return []


def _create_mcp_tool(
    mcp_client: "MCPClient",
    server: str,
    tool_name: str,
    full_name: str,
    description: str,
    parameters: Dict[str, Any],
) -> Optional[BaseTool]:
    """Create a single MCP tool.

    Args:
        mcp_client: MCP client instance
        server: Server name
        tool_name: Original tool name
        full_name: Full tool name with prefix
        description: Tool description
        parameters: Tool parameters

    Returns:
        LangChain BaseTool or None
    """
    try:
        # Create async function that calls MCP
        async def _execute_mcp_tool(**kwargs) -> str:
            """Execute MCP tool."""
            try:
                result = await mcp_client.execute_tool(server, tool_name, **kwargs)
                return str(result) if result else "No result returned"
            except Exception as e:
                logger.error(f"MCP tool {server}.{tool_name} failed: {e}")
                return f"Error executing tool: {e}"

        # Synchronous wrapper for LangChain compatibility
        def execute_mcp_tool_sync(**kwargs) -> str:
            """Sync wrapper for MCP tool execution."""
            try:
                # Check if we're already in an async context
                try:
                    loop = asyncio.get_running_loop()
                    # We're inside a running loop - can't use run_until_complete
                    # Use ThreadPoolExecutor to run in a new thread with fresh event loop
                    import concurrent.futures

                    def run_in_new_loop():
                        new_loop = asyncio.new_event_loop()
                        asyncio.set_event_loop(new_loop)
                        try:
                            return new_loop.run_until_complete(_execute_mcp_tool(**kwargs))
                        finally:
                            new_loop.close()

                    with concurrent.futures.ThreadPoolExecutor() as executor:
                        future = executor.submit(run_in_new_loop)
                        return future.result(timeout=60)
                except RuntimeError:
                    # No running loop - create a fresh one
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)
                    try:
                        return loop.run_until_complete(_execute_mcp_tool(**kwargs))
                    finally:
                        loop.close()
            except Exception as e:
                logger.error(f"MCP tool sync wrapper failed: {e}")
                return f"Error: {e}"

        # Create input model if parameters exist
        if parameters:
            input_model = _create_tool_input_model(tool_name, parameters)
            return StructuredTool.from_function(
                func=execute_mcp_tool_sync,
                coroutine=_execute_mcp_tool,
                name=full_name,
                description=description,
                args_schema=input_model,
            )
        else:
            return StructuredTool.from_function(
                func=execute_mcp_tool_sync,
                coroutine=_execute_mcp_tool,
                name=full_name,
                description=description,
            )

    except Exception as e:
        logger.error(f"Failed to create MCP tool {full_name}: {e}")
        return None


def get_mcp_tool_names(tools: List[BaseTool]) -> List[str]:
    """Get names of MCP tools from a tool list.

    Args:
        tools: List of tools

    Returns:
        List of MCP tool names
    """
    return [t.name for t in tools if t.name.startswith("mcp_")]
