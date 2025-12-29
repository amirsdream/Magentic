"""Agent execution logic."""

import asyncio
import json
import logging
import re
import time
from typing import Dict, Any, List, Optional, Callable, TYPE_CHECKING

from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_core.runnables import RunnableConfig
from langchain_core.language_models import BaseChatModel
from langchain_core.tools import BaseTool

from ..role_library import RoleLibrary, AgentRole as Role
from ..config import Config
from .token_tracker import get_tracker, TokenUsage

# Import metrics (optional)
try:
    from ..metrics import (
        PROMETHEUS_AVAILABLE,
        AGENT_EXECUTIONS_TOTAL,
        AGENT_EXECUTION_DURATION,
        AGENTS_IN_PROGRESS,
        TOOL_CALLS_TOTAL,
        TOOL_CALL_DURATION,
        record_error,
        record_llm_request,
    )
except ImportError:
    PROMETHEUS_AVAILABLE = False
    AGENT_EXECUTIONS_TOTAL = None
    AGENT_EXECUTION_DURATION = None
    AGENTS_IN_PROGRESS = None
    TOOL_CALLS_TOTAL = None
    TOOL_CALL_DURATION = None
    record_error = None
    record_llm_request = None

if TYPE_CHECKING:
    from ..tools.manager import ToolManager

logger = logging.getLogger(__name__)

# Load config for limits
_config = Config()


class AgentExecutor:
    """Handles execution of individual agents with MCP gateway integration."""

    def __init__(
        self,
        llm: BaseChatModel,
        tools: List[BaseTool],
        role_library: RoleLibrary,
        ui_display_limit: int = 200,
        tool_manager: Optional["ToolManager"] = None,
    ):
        """Initialize agent executor.

        Args:
            llm: Language model instance
            tools: Default available tools (fallback)
            role_library: Role definitions library
            ui_display_limit: Max characters for output display
            tool_manager: Optional tool manager for role-specific tools
        """
        self.llm = llm
        self.tools = tools  # Default/fallback tools
        self.role_library = role_library
        self.ui_display_limit = ui_display_limit
        self.tool_manager = tool_manager
        self._role_tools_cache: Dict[str, List[BaseTool]] = {}

        # Context limits from config
        self.context_limit = _config.agent_context_limit
        self.history_limit = _config.agent_history_limit
        
        # Tool call limits (guardrails)
        self.max_tool_iterations = _config.max_tool_iterations
        self.max_tool_calls_per_agent = _config.max_tool_calls_per_agent
        
        # Log callback for streaming logs to UI
        self._log_callback: Optional[Callable[[str, str, str, Optional[Dict[str, Any]]], None]] = None
        self._current_agent_id: str = ""

    def set_log_callback(self, callback: Optional[Callable[[str, str, str, Optional[Dict[str, Any]]], None]]) -> None:
        """Set a callback to receive log events during execution.
        
        Args:
            callback: Function(agent_id, log_type, content, metadata) called for each log event
                     log_type can be: 'llm_start', 'llm_end', 'tool_start', 'tool_end', 'info'
        """
        self._log_callback = callback

    def _emit_log(self, log_type: str, content: str, metadata: Optional[Dict[str, Any]] = None) -> None:
        """Emit a log event to the registered callback."""
        logger.info(f"📝 _emit_log called: agent={self._current_agent_id}, type={log_type}, callback={self._log_callback is not None}")
        if self._log_callback and self._current_agent_id:
            try:
                self._log_callback(self._current_agent_id, log_type, content, metadata)
                logger.info(f"📝 _emit_log callback invoked successfully")
            except Exception as e:
                logger.warning(f"Log callback failed: {e}")

    def _record_agent_start(self) -> float:
        """Record agent execution start for metrics."""
        if PROMETHEUS_AVAILABLE and AGENTS_IN_PROGRESS:
            AGENTS_IN_PROGRESS.inc()
        return time.perf_counter()

    def _record_agent_end(self, agent_type: str, start_time: float, success: bool):
        """Record agent execution completion for metrics."""
        if not PROMETHEUS_AVAILABLE:
            return
        duration = time.perf_counter() - start_time
        if AGENTS_IN_PROGRESS:
            AGENTS_IN_PROGRESS.dec()
        if AGENT_EXECUTIONS_TOTAL:
            AGENT_EXECUTIONS_TOTAL.labels(
                agent_type=agent_type,
                status='success' if success else 'error'
            ).inc()
        if AGENT_EXECUTION_DURATION:
            AGENT_EXECUTION_DURATION.labels(agent_type=agent_type).observe(duration)

    def _record_tool_call(self, tool_name: str, duration: float, success: bool, error_type: Optional[str] = None):
        """Record tool call for metrics."""
        if not PROMETHEUS_AVAILABLE:
            return
        if TOOL_CALLS_TOTAL:
            TOOL_CALLS_TOTAL.labels(
                tool_name=tool_name,
                status='success' if success else 'error'
            ).inc()
        if TOOL_CALL_DURATION:
            TOOL_CALL_DURATION.labels(tool_name=tool_name).observe(duration)
        # Optionally record the error
        if not success and error_type and record_error:
            record_error(error_type, f'tool_{tool_name}')

    def _record_llm_request(self, duration: float, success: bool):
        """Record LLM request metrics."""
        if not PROMETHEUS_AVAILABLE or not record_llm_request:
            return
        # Get provider and model from config
        provider = _config.llm_provider
        model = _config.get_model_name()
        record_llm_request(provider, model, duration, success)

    def _invoke_llm(self, messages: list, config: RunnableConfig, llm: Any = None) -> Any:
        """Invoke LLM with metrics tracking.
        
        Args:
            messages: List of messages to send to the LLM
            config: RunnableConfig for the invocation
            llm: Optional LLM or LLM with tools to use (defaults to self.llm)
            
        Returns:
            LLM response
        """
        llm_to_use = llm or self.llm
        
        # Emit log for LLM start
        model_name = getattr(llm_to_use, 'model_name', None) or getattr(llm_to_use, 'model', 'unknown')
        last_msg = messages[-1].content if messages else ""
        preview = last_msg[:100] + "..." if len(last_msg) > 100 else last_msg
        self._emit_log('llm_start', f"Calling {model_name}...", {'preview': preview})
        
        start_time = time.time()
        try:
            response = llm_to_use.invoke(messages, config=config)
            duration = time.time() - start_time
            self._record_llm_request(duration, True)
            
            # Emit log for LLM end
            response_preview = str(response.content)[:150] + "..." if len(str(response.content)) > 150 else str(response.content)
            self._emit_log('llm_end', f"LLM responded ({duration:.1f}s)", {'preview': response_preview})
            
            return response
        except Exception as e:
            self._record_llm_request(time.time() - start_time, False)
            self._emit_log('error', f"LLM error: {str(e)[:100]}")
            if PROMETHEUS_AVAILABLE and record_error:
                record_error(type(e).__name__, 'llm')
            raise

    def _track_tokens(self, response: Any, agent_id: str = "", role: str = "") -> TokenUsage:
        """Track tokens from an LLM response.

        Args:
            response: LLM response object
            agent_id: Agent identifier
            role: Agent role name

        Returns:
            TokenUsage extracted from response
        """
        tracker = get_tracker()
        if agent_id and role:
            return tracker.add_agent_usage(agent_id, role, response)
        return tracker.extract_usage_from_response(response)

    def _extract_references_from_tool_output(self, tool_name: str, output: str) -> List[Dict[str, Any]]:
        """Extract references from tool output.
        
        Args:
            tool_name: Name of the tool that produced the output
            output: Tool output string
            
        Returns:
            List of reference dictionaries with type, source, title, url, snippet
            Limited to top 5-8 most relevant chunks
        """
        references = []
        
        if not output:
            return references
            
        # Extract RAG/Knowledge Base references
        if "knowledge_base" in tool_name.lower() or "search_knowledge_base" in tool_name.lower():
            # Pattern: [Document N] (relevance: X.XXX, source: filename)
            rag_pattern = r'\[Document \d+\] \(relevance: ([\d.]+), source: ([^)]+)\)\n(.*?)(?=\n\n\[Document|\Z)'
            matches = re.findall(rag_pattern, output, re.DOTALL)
            
            all_refs = []
            for match in matches:
                relevance, source, content = match
                snippet = content.strip()[:150]
                # Create a more descriptive title using first line of content
                first_line = content.strip().split('\n')[0][:50]
                title = f"{source.strip()}: {first_line}..." if first_line else source.strip()
                
                all_refs.append({
                    "type": "knowledge_base",
                    "source": source.strip(),
                    "title": title,
                    "relevance": float(relevance),
                    "snippet": snippet + "..." if len(content.strip()) > 150 else snippet
                })
            
            # Sort by relevance and take top 8 (enough for good coverage, not overwhelming)
            sorted_refs = sorted(all_refs, key=lambda x: x["relevance"], reverse=True)
            references = sorted_refs[:8]
                
        # Extract web search references (URLs)
        elif "search" in tool_name.lower() or "web" in tool_name.lower():
            # Try to parse as JSON first (MCP web search often returns JSON)
            try:
                data = json.loads(output)
                if isinstance(data, dict) and 'results' in data:
                    for result in data['results'][:5]:
                        ref = {
                            "type": "web",
                            "title": result.get('title', ''),
                            "url": result.get('url', ''),
                            "source": result.get('url', ''),
                            "snippet": result.get('snippet', result.get('content', ''))[:200]
                        }
                        if ref['url']:
                            references.append(ref)
                    return references
            except (json.JSONDecodeError, TypeError):
                pass
            
            # Look for URLs in the output
            url_pattern = r'https?://[^\s<>"\')\]]+(?:[.,?!])?'
            urls_found = re.findall(url_pattern, output)
            
            # Also look for structured results with title/url/snippet
            # Pattern for typical search results: Title: ... URL: ... or similar
            lines = output.split('\n')
            current_ref = {}
            
            for line in lines:
                line = line.strip()
                if line.lower().startswith('title:'):
                    if current_ref.get('url'):
                        references.append(current_ref)
                    current_ref = {"type": "web", "title": line[6:].strip()}
                elif line.lower().startswith('url:'):
                    current_ref["url"] = line[4:].strip()
                    current_ref["source"] = current_ref.get("url", "")
                elif line.lower().startswith('snippet:') or line.lower().startswith('content:'):
                    current_ref["snippet"] = line.split(':', 1)[1].strip()[:200]
                elif 'http' in line and 'url' not in current_ref:
                    # Extract URL from the line
                    url_match = re.search(url_pattern, line)
                    if url_match:
                        current_ref["url"] = url_match.group(0).rstrip('.,?!')
                        current_ref["source"] = current_ref["url"]
                        current_ref["type"] = "web"
                        
            if current_ref.get('url'):
                references.append(current_ref)
                
            # If no structured refs found but URLs exist, create refs from URLs
            if not references and urls_found:
                for url in urls_found[:5]:  # Limit to 5 URLs
                    url = url.rstrip('.,?!')
                    references.append({
                        "type": "web",
                        "url": url,
                        "source": url,
                        "title": self._extract_domain_from_url(url)
                    })
                    
        return references
    
    def _extract_domain_from_url(self, url: str) -> str:
        """Extract readable domain name from URL."""
        try:
            from urllib.parse import urlparse
            parsed = urlparse(url)
            domain = parsed.netloc
            # Remove www. prefix
            if domain.startswith('www.'):
                domain = domain[4:]
            return domain
        except:
            return url[:50]

    def _extract_artifacts_from_tool_output(self, tool_name: str, tool_args: Dict[str, Any], output: str) -> List[Dict[str, Any]]:
        """Extract file artifacts from tool output.
        
        Args:
            tool_name: Name of the tool that was called
            tool_args: Arguments passed to the tool
            output: Tool output string
            
        Returns:
            List of artifact dictionaries with path, type, name (deduplicated by path)
        """
        artifacts = []
        seen_paths = set()
        
        def add_artifact(path: str, size: int = 0):
            """Add artifact if not already seen."""
            if path and path not in seen_paths:
                seen_paths.add(path)
                artifacts.append({
                    "type": "file",
                    "path": path,
                    "name": path.split("/")[-1] if "/" in path else path,
                    "size": size,
                    "language": self._get_file_language(path)
                })
        
        if not output:
            return artifacts
        
        # Check for file write operations
        if "write_file" in tool_name.lower() or "filesystem" in tool_name.lower():
            # Try to parse as JSON response
            try:
                data = json.loads(output)
                if isinstance(data, dict):
                    path = data.get("path") or tool_args.get("path")
                    if path and data.get("success", True):
                        add_artifact(path, data.get("size", 0))
            except (json.JSONDecodeError, TypeError):
                # Try to extract path from tool args
                path = tool_args.get("path")
                if path:
                    add_artifact(path)
        
        # Check for python code execution that creates files
        elif "python" in tool_name.lower() and "execute" in tool_name.lower():
            # Look for file creation patterns in output
            file_patterns = [
                r"(?:saved|written|created|exported)\s+(?:to|as|file)?\s*['\"]?([^\s'\"]+\.[a-zA-Z0-9]+)['\"]?",
                r"File\s+['\"]?([^\s'\"]+\.[a-zA-Z0-9]+)['\"]?\s+(?:saved|written|created)",
            ]
            for pattern in file_patterns:
                matches = re.findall(pattern, output, re.IGNORECASE)
                for match in matches:
                    if match and not match.startswith('http'):
                        add_artifact(match)
        
        return artifacts
    
    def _get_file_language(self, path: str) -> str:
        """Get programming language/type from file extension."""
        ext_map = {
            ".py": "python",
            ".js": "javascript",
            ".ts": "typescript",
            ".jsx": "javascript",
            ".tsx": "typescript",
            ".html": "html",
            ".css": "css",
            ".json": "json",
            ".yaml": "yaml",
            ".yml": "yaml",
            ".md": "markdown",
            ".txt": "text",
            ".sql": "sql",
            ".sh": "bash",
            ".bash": "bash",
            ".csv": "csv",
            ".xml": "xml",
        }
        ext = "." + path.split(".")[-1].lower() if "." in path else ""
        return ext_map.get(ext, "text")

    def _build_citation_guide(self, references: List[Dict[str, Any]]) -> str:
        """Build a citation guide for the LLM to use when writing responses.
        
        Args:
            references: List of reference dictionaries
            
        Returns:
            String with numbered references for the LLM to cite
        """
        if not references:
            return ""
        
        lines = [
            "CITATION GUIDE - Use these numbered references in your response:",
            "Place the citation number in brackets [N] right after the relevant sentence.",
            "Use different numbers for information from different sources.",
            ""
        ]
        
        for i, ref in enumerate(references, 1):
            ref_type = ref.get("type", "source")
            title = ref.get("title", ref.get("source", "Unknown"))
            snippet = ref.get("snippet", "")[:100]
            
            if ref_type == "web":
                url = ref.get("url", "")
                lines.append(f"[{i}] {title} ({url[:50]}...)" if len(url) > 50 else f"[{i}] {title} ({url})")
            else:
                relevance = ref.get("relevance", 0)
                lines.append(f"[{i}] {title} (relevance: {relevance:.2f})")
            
            if snippet:
                lines.append(f"    Preview: {snippet}...")
            lines.append("")
        
        lines.append("Remember: Cite [1], [2], [3], etc. inline after relevant claims!")
        return "\n".join(lines)

    async def pre_cache_role_tools(self) -> None:
        """Pre-cache tools for all known roles.

        Call this during async initialization to avoid sync/async issues later.
        """
        if not self.tool_manager:
            return

        for role_name in self.role_library.list_roles():
            try:
                tools = await self.get_tools_for_role(role_name)
                logger.debug(f"Pre-cached {len(tools)} tools for role '{role_name}'")
            except Exception as e:
                logger.warning(f"Failed to pre-cache tools for role '{role_name}': {e}")

    async def get_tools_for_role(self, role_name: str) -> List[BaseTool]:
        """Get tools appropriate for a specific role.

        Uses tool_manager for role-specific MCP tools if available,
        otherwise falls back to default tools.

        Args:
            role_name: Name of the agent role

        Returns:
            List of tools for the role
        """
        # Check cache first
        if role_name in self._role_tools_cache:
            return self._role_tools_cache[role_name]

        # Try to get role-specific tools from tool manager
        if self.tool_manager:
            try:
                role_tools = await self.tool_manager.get_tools_for_role(role_name)
                if role_tools:
                    self._role_tools_cache[role_name] = role_tools
                    logger.info(f"Role '{role_name}' using {len(role_tools)} role-specific tools")
                    return role_tools
            except Exception as e:
                logger.warning(f"Failed to get role-specific tools for {role_name}: {e}")

        # Fall back to default tools
        self._role_tools_cache[role_name] = self.tools
        return self.tools

    def get_tools_for_role_sync(self, role_name: str) -> List[BaseTool]:
        """Synchronous wrapper to get tools for a role.

        Args:
            role_name: Name of the agent role

        Returns:
            List of tools for the role
        """
        # Check cache first (fastest path)
        if role_name in self._role_tools_cache:
            return self._role_tools_cache[role_name]

        # Try to run async function from sync context
        try:
            # Check if we're already in an async context
            try:
                loop = asyncio.get_running_loop()
                # We're inside a running loop - can't use run_until_complete
                # Use nest_asyncio or run in executor
                import concurrent.futures

                with concurrent.futures.ThreadPoolExecutor() as executor:
                    future = executor.submit(
                        lambda: asyncio.run(self.get_tools_for_role(role_name))
                    )
                    return future.result(timeout=30)
            except RuntimeError:
                # No running loop - safe to use asyncio.run
                return asyncio.run(self.get_tools_for_role(role_name))
        except Exception as e:
            logger.warning(f"Failed to get role tools synchronously: {e}, using defaults")
            return self.tools

    def execute(
        self,
        role: Role,
        task: str,
        original_query: str,
        previous_outputs: List[str],
        conversation_history: Optional[List[Dict[str, str]]] = None,
        depth: int = 0,
        max_depth: int = 3,
        process_query_callback: Optional[Callable] = None,
        agent_id: str = "",
    ) -> Dict[str, Any]:
        """Execute a single agent.

        Args:
            role: Agent role definition
            task: Specific task for this agent
            original_query: Original user query
            previous_outputs: Outputs from previous agents
            conversation_history: Conversation history
            depth: Current execution depth
            max_depth: Maximum execution depth
            process_query_callback: Callback for recursive delegation
            agent_id: Agent identifier for token tracking

        Returns:
            Dict with 'content' (text output) and 'tool_calls' (list of tools used)
        """
        # Start metrics tracking
        start_time = self._record_agent_start()
        success = False
        
        try:
            result = self._execute_internal(
                role, task, original_query, previous_outputs,
                conversation_history, depth, max_depth,
                process_query_callback, agent_id
            )
            success = True
            return result
        except Exception as e:
            if PROMETHEUS_AVAILABLE and record_error:
                record_error(type(e).__name__, f'agent_{role.name}')
            raise
        finally:
            self._record_agent_end(role.name, start_time, success)

    def _execute_internal(
        self,
        role: Role,
        task: str,
        original_query: str,
        previous_outputs: List[str],
        conversation_history: Optional[List[Dict[str, str]]] = None,
        depth: int = 0,
        max_depth: int = 3,
        process_query_callback: Optional[Callable] = None,
        agent_id: str = "",
    ) -> Dict[str, Any]:
        """Internal execute implementation."""
        # Set current agent ID for logging
        self._current_agent_id = agent_id
        
        # Emit agent execution start log
        self._emit_log('info', f"Starting {role.name} agent", {'task': task[:100]})
        
        # Build context
        context = self._build_context(original_query, previous_outputs, conversation_history)

        # Build messages
        output_limit_instruction = (
            f"\n\nIMPORTANT: Keep your response concise and under "
            f"{self.ui_display_limit} characters. Be direct and focused."
        )
        citation_instruction = (
            "\n\nWhen citing sources from tools (knowledge base, web search), use inline citations "
            "like Wikipedia: place [1], [2], etc. right after the relevant sentence or claim. "
            "Number citations in order of first appearance. Example: 'The sky is blue [1]. Water is essential for life [2].'"
        )
        artifact_instruction = (
            "\n\nWhen files/artifacts are mentioned as available from previous agents, you should:"
            "\n1. Read the file using mcp_filesystem_read_file tool before using its content"
            "\n2. If you create files, use mcp_filesystem_write_file with clear descriptive names"
        )
        system_msg = SystemMessage(content=role.system_prompt + output_limit_instruction + citation_instruction + artifact_instruction)
        task_msg = HumanMessage(content=f"{context}\n\nYour task: {task}")

        logger.info(f"Task message content (first 500 chars): {task_msg.content[:500]}...")

        # Check if agent can and should delegate
        if role.can_delegate and depth < max_depth:
            task_msg = self._build_delegation_prompt(context, task)

        # Add metadata for Phoenix tracing
        config = self._create_run_config(role, task)

        # Execute with or without tools
        if role.needs_tools:
            return self._execute_with_tools(role, system_msg, task_msg, config, agent_id)
        else:
            return self._execute_without_tools(
                role, system_msg, task_msg, config, task, depth, max_depth, process_query_callback, agent_id
            )

    def _build_context(
        self,
        original_query: str,
        previous_outputs: List[str],
        conversation_history: Optional[List[Dict[str, str]]],
    ) -> str:
        """Build context string from query and previous outputs."""
        context_parts = [f"Original question: {original_query}"]

        if conversation_history:
            context_parts.append("\n=== Previous Agent Conversation Steps ===")
            for i, step in enumerate(conversation_history[-3:], 1):
                context_parts.append(
                    f"\nStep {i} - {step.get('role', 'unknown')} ({step.get('agent_id', '')}):"
                )
                context_parts.append(f"  Task: {step.get('task', '')[:100]}")
                step_output = step.get("output", "")[: self.history_limit]
                context_parts.append(f"  Output: {step_output}...")

        if previous_outputs:
            logger.info(f"Agent has {len(previous_outputs)} previous outputs to incorporate")
            context_parts.append("\n=== Outputs from Previous Agents ===")
            for i, output in enumerate(previous_outputs, 1):
                output_display = (
                    output[: self.context_limit] + "..."
                    if len(output) > self.context_limit
                    else output
                )
                context_parts.append(f"\nAgent {i} output:\n{output_display}")
        else:
            context_parts.append("\n=== You are the first agent ===")
            context_parts.append("No prior agent outputs available yet.")

        return "\n".join(context_parts)

    def _build_delegation_prompt(self, context: str, task: str) -> HumanMessage:
        """Build delegation prompt for agents that can delegate."""
        delegation_prompt = f"""
{context}

Your task: {task}

You have the ability to delegate work to specialized sub-agents. 
If this task would benefit from delegation, respond with JSON:
{{
  "needs_delegation": true,
  "subtasks": [
    {{"role": "role_name", "task": "specific task"}},
    ...
  ]
}}

Otherwise, complete the task directly and respond with your normal output (not JSON).

IMPORTANT: If completing directly, keep your response under {self.ui_display_limit} characters.
"""
        return HumanMessage(content=delegation_prompt)

    def _create_run_config(self, role: Role, task: str) -> RunnableConfig:
        """Create run configuration for tracing."""
        metadata = {"agent_role": role.name, "agent_task": task, "has_tools": role.needs_tools}
        return {
            "run_name": f"{role.name}_agent",
            "metadata": metadata,
            "tags": [role.name, "meta_agent"],
        }  # type: ignore

    def _execute_with_tools(
        self, role: Role, system_msg: SystemMessage, task_msg: HumanMessage, config: RunnableConfig, agent_id: str = ""
    ) -> Dict[str, Any]:
        """Execute agent with tool access."""
        # Get role-specific tools
        role_tools = self.get_tools_for_role_sync(role.name)

        if not role_tools:
            logger.error(f"⚠️ {role.name} needs tools but no tools are available!")
            response = self._invoke_llm([system_msg, task_msg], config)
            self._track_tokens(response, agent_id, role.name)  # Track token usage
            return {"content": str(response.content), "tool_calls": [], "references": []}

        logger.info(f"🔧 {role.name} has access to {len(role_tools)} tools")

        # Special handling for researcher role
        if role.name == "researcher":
            return self._execute_researcher(role, system_msg, task_msg, config, role_tools, agent_id)

        # Standard tool calling for other roles
        return self._execute_standard_tool_calling(role, system_msg, task_msg, config, role_tools, agent_id)

    def _execute_researcher(
        self,
        role: Role,
        system_msg: SystemMessage,
        task_msg: HumanMessage,
        config: RunnableConfig,
        role_tools: List[BaseTool],
        agent_id: str = "",
    ) -> Dict[str, Any]:
        """Execute researcher agent with web search."""
        logger.info(f"🔍 {role.name} will perform web search")

        # Get search queries from LLM
        search_prompt = SystemMessage(
            content="""You are a research specialist planning a web search.
Based on the task, provide 1-3 search queries (one per line) that would give the best results.
Just output the search queries, nothing else. No explanations, no numbering.
IMPORTANT: Keep search queries short and focused."""
        )

        search_response = self._invoke_llm([search_prompt, task_msg], config)
        self._track_tokens(search_response, agent_id, role.name)  # Track token usage
        search_queries = str(search_response.content).strip().split("\n")
        search_queries = [q.strip() for q in search_queries if q.strip()][:3]

        logger.info(f"   └─ Search queries: {search_queries}")

        # Find search tool - prefer MCP websearch if available
        search_tool = self._find_search_tool(role_tools)
        if not search_tool:
            logger.error("   └─ No search tool found!")
            response = self._invoke_llm([system_msg, task_msg], config)
            self._track_tokens(response, agent_id, role.name)  # Track token usage
            return {"content": str(response.content), "tool_calls": [], "references": []}

        # Execute searches
        tool_results = self._execute_searches(search_tool, search_queries)
        
        # Extract references from search results
        all_references = []
        for result in tool_results:
            refs = self._extract_references_from_tool_output(search_tool.name, result)
            all_references.extend(refs)
        
        if all_references:
            logger.info(f"   └─ Extracted {len(all_references)} reference(s) from search results")

        # Generate response with search results
        if tool_results:
            tool_context = "\n\n".join(
                [f"Search result {i+1}:\n{r}" for i, r in enumerate(tool_results)]
            )
            logger.info(f"📥 {role.name} processing {len(tool_results)} search result(s)")

            final_response = self._invoke_llm(
                [
                    system_msg,
                    task_msg,
                    AIMessage(
                        content=f"Based on these search results:\n\n{tool_context}\n\n"
                        f"Provide a comprehensive research summary. Keep it under "
                        f"{self.ui_display_limit} characters - be concise and focused on key findings."
                    ),
                ],
                config,
            )
            self._track_tokens(final_response, agent_id, role.name)  # Track token usage

            return {
                "content": str(final_response.content),
                "tool_calls": [
                    {"name": search_tool.name, "args": {"query": q}} for q in search_queries
                ],
                "references": all_references,
            }

        # No results - fallback
        response = self._invoke_llm([system_msg, task_msg], config)
        self._track_tokens(response, agent_id, role.name)  # Track token usage
        return {"content": str(response.content), "tool_calls": [], "references": []}

    def _find_search_tool(self, role_tools: List[BaseTool]) -> Optional[BaseTool]:
        """Find search tool - prefers MCP websearch over DuckDuckGo.

        Args:
            role_tools: List of available tools for the role

        Returns:
            Search tool if found
        """
        # First try MCP websearch
        for tool in role_tools:
            if "mcp_websearch_search" in tool.name:
                logger.info(f"   └─ Using MCP websearch tool: {tool.name}")
                return tool

        # Fall back to DuckDuckGo
        for tool in role_tools:
            if tool.name in ["duckduckgo_search", "ddg-search"]:
                logger.info(f"   └─ Using DuckDuckGo search tool: {tool.name}")
                return tool

        return None

    def _execute_searches(self, search_tool: BaseTool, queries: List[str]) -> List[str]:
        """Execute search queries and return results."""
        results = []
        for query in queries:
            query = query.lstrip("0123456789.-) ").strip()
            if not query:
                continue
            start_time = time.time()
            try:
                logger.info(f"   └─ Searching: {query}")
                result = search_tool.invoke({"query": query})
                duration = time.time() - start_time
                success = result is not None
                self._record_tool_call(search_tool.name, duration, success)
                if result:
                    results.append(result)
                    logger.info(f"🔍 SEARCH RESULT for '{query}': {result[:200]}...")
            except Exception as e:
                duration = time.time() - start_time
                self._record_tool_call(search_tool.name, duration, False, type(e).__name__)
                logger.error(f"   └─ Search error for '{query}': {e}")
                results.append(f"Search failed for '{query}': {e}")
        return results

    def _execute_standard_tool_calling(
        self,
        role: Role,
        system_msg: SystemMessage,
        task_msg: HumanMessage,
        config: RunnableConfig,
        role_tools: List[BaseTool],
        agent_id: str = "",
        max_tool_iterations: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Execute agent with standard tool calling and iteration loop.
        
        The agent can make multiple rounds of tool calls until it provides
        a final answer or reaches max iterations/tool calls.
        
        Guardrails:
        - max_tool_iterations: Max LLM response rounds (default from config)
        - max_tool_calls_per_agent: Max total tool invocations (from config)
        """
        # Use config values as defaults
        max_iterations = max_tool_iterations or self.max_tool_iterations
        max_total_calls = self.max_tool_calls_per_agent
        
        llm_with_tools = self.llm.bind_tools(role_tools)
        logger.info(
            f"🔧 {role.name} bound with {len(role_tools)} tools: {[t.name for t in role_tools[:5]]}..."
        )
        logger.info(f"   └─ Guardrails: max {max_iterations} iterations, max {max_total_calls} tool calls")

        all_tool_calls = []
        all_references = []  # Track references from tool outputs
        all_artifacts = {}   # Track file artifacts created by tools (path -> artifact for dedup)
        total_tool_calls = 0
        messages = [system_msg, task_msg]
        iteration = 0
        
        def dedupe_artifacts():
            """Return deduplicated artifacts list."""
            return list(all_artifacts.values())
        
        for iteration in range(max_iterations):
            response = self._invoke_llm(messages, config, llm=llm_with_tools)
            self._track_tokens(response, agent_id, role.name)

            # Check if agent wants to call tools
            if hasattr(response, "tool_calls") and response.tool_calls:
                num_calls = len(response.tool_calls)
                logger.info(f"🔍 {role.name} iteration {iteration + 1}: calling {num_calls} tool(s)")
                
                # Check if we'd exceed max total tool calls
                if total_tool_calls + num_calls > max_total_calls:
                    remaining = max_total_calls - total_tool_calls
                    logger.warning(
                        f"⚠️ {role.name} tool call limit reached! "
                        f"Requested {num_calls}, only {remaining} allowed (max {max_total_calls})"
                    )
                    if remaining <= 0:
                        # No more calls allowed, force final answer
                        break
                    # Only process remaining allowed calls
                    response.tool_calls = response.tool_calls[:remaining]
                
                tool_results = []
                for tool_call in response.tool_calls:
                    tool_name, tool_args = self._parse_tool_call(tool_call)
                    all_tool_calls.append({"name": tool_name, "args": tool_args})
                    total_tool_calls += 1
                    logger.info(f"   └─ Tool [{total_tool_calls}/{max_total_calls}]: {tool_name}, Args: {tool_args}")
                    
                    result = self._execute_tool(tool_name, tool_args, role_tools)
                    result_str = result or "No result returned"
                    tool_results.append({
                        "tool": tool_name,
                        "result": result_str
                    })
                    
                    # Extract references from tool output
                    refs = self._extract_references_from_tool_output(tool_name, result_str)
                    if refs:
                        all_references.extend(refs)
                        logger.info(f"   └─ Extracted {len(refs)} reference(s) from {tool_name}")
                    
                    # Extract artifacts (created files) from tool output
                    artifacts = self._extract_artifacts_from_tool_output(tool_name, tool_args, result_str)
                    if artifacts:
                        for artifact in artifacts:
                            path = artifact.get("path", "")
                            if path:
                                all_artifacts[path] = artifact  # Dedupe by path
                        logger.info(f"   └─ Extracted {len(artifacts)} artifact(s) from {tool_name}")
                
                # Check if we hit the limit after processing
                if total_tool_calls >= max_total_calls:
                    logger.warning(f"⚠️ {role.name} reached max tool calls ({max_total_calls}), forcing final answer")
                    tool_results_text = "\n\n".join([
                        f"Tool '{r['tool']}' result:\n{r['result']}" 
                        for r in tool_results
                    ])
                    messages.append(AIMessage(content=f"Tool calls completed. Results:\n\n{tool_results_text}"))
                    # Add reference list for citations
                    if all_references:
                        ref_list = self._build_citation_guide(all_references)
                        messages.append(HumanMessage(content=ref_list))
                    break
                
                # Add tool results to message history for next iteration
                tool_results_text = "\n\n".join([
                    f"Tool '{r['tool']}' result:\n{r['result']}" 
                    for r in tool_results
                ])
                messages.append(AIMessage(content=f"Tool calls completed. Results:\n\n{tool_results_text}"))
                
                # Build continuation prompt - include already created files to prevent duplicates
                continue_prompt = "If you have completed your task, provide your final answer now."
                if all_artifacts:
                    created_files = [a.get("name", a.get("path", "")) for a in all_artifacts.values()]
                    continue_prompt += f"\n\nFiles already created: {', '.join(created_files)}"
                    continue_prompt += "\nDo NOT create any more files. Your file creation task is DONE."
                else:
                    continue_prompt += "\nIf you still need to use tools to complete the EXACT task you were given, call them."
                continue_prompt += "\nDo NOT repeat actions you have already completed."
                messages.append(HumanMessage(content=continue_prompt))
            else:
                # No more tool calls - agent is done
                logger.info(f"✅ {role.name} completed after {iteration + 1} iteration(s), {total_tool_calls} tool calls")
                
                # If we have references, ask LLM to rewrite with proper citations
                if all_references and total_tool_calls > 0:
                    ref_guide = self._build_citation_guide(all_references)
                    cited_response = self._invoke_llm(
                        messages + [
                            AIMessage(content=str(response.content)),
                            HumanMessage(content=f"{ref_guide}\n\nPlease rewrite your response above with inline citations [1], [2], etc. using the reference numbers provided. Keep the same content but add citation markers after relevant claims.")
                        ],
                        config,
                    )
                    self._track_tokens(cited_response, agent_id, role.name)
                    return {"content": str(cited_response.content), "tool_calls": all_tool_calls, "references": all_references, "artifacts": dedupe_artifacts()}
                
                return {"content": str(response.content), "tool_calls": all_tool_calls, "references": all_references, "artifacts": dedupe_artifacts()}
        
        # Max iterations or tool calls reached - get final answer
        logger.info(f"🔍 {role.name} reached limits (iter={iteration + 1}/{max_iterations}, tools={total_tool_calls}/{max_total_calls}), getting final answer")
        
        # Build citation guide if we have references
        final_messages = messages.copy()
        final_prompt = "You have reached the tool call limit. Please provide your final answer now based on all the tool results above."
        if all_references:
            ref_guide = self._build_citation_guide(all_references)
            final_prompt = f"{ref_guide}\n\n{final_prompt}"
        
        final_response = self._invoke_llm(
            final_messages + [HumanMessage(content=final_prompt)],
            config,
        )
        self._track_tokens(final_response, agent_id, role.name)
        return {"content": str(final_response.content), "tool_calls": all_tool_calls, "references": all_references, "artifacts": dedupe_artifacts()}

    def _process_tool_calls(
        self,
        role: Role,
        system_msg: SystemMessage,
        task_msg: HumanMessage,
        response,
        config: RunnableConfig,
        role_tools: List[BaseTool],
        agent_id: str = "",
    ) -> Dict[str, Any]:
        """Process tool calls from LLM response."""
        logger.info(f"🔍 {role.name} is calling {len(response.tool_calls)} tool(s)")

        recorded_calls = []
        tool_results = []

        for tool_call in response.tool_calls:
            tool_name, tool_args = self._parse_tool_call(tool_call)
            recorded_calls.append({"name": tool_name, "args": tool_args})

            logger.info(f"   └─ Tool: {tool_name}, Args: {tool_args}")

            result = self._execute_tool(tool_name, tool_args, role_tools)
            if result:
                tool_results.append(result)

        if tool_results:
            tool_context = "\n\n".join([f"Result {i+1}:\n{r}" for i, r in enumerate(tool_results)])
            final_response = self._invoke_llm(
                [
                    system_msg,
                    task_msg,
                    AIMessage(
                        content=f"Based on these results:\n\n{tool_context}\n\nProvide a comprehensive answer."
                    ),
                ],
                config,
            )
            self._track_tokens(final_response, agent_id, role.name)  # Track token usage
            return {"content": str(final_response.content), "tool_calls": recorded_calls}

        return {"content": str(response.content), "tool_calls": recorded_calls}

    def _parse_tool_call(self, tool_call) -> tuple[str, dict]:
        """Parse tool call into name and arguments."""
        if isinstance(tool_call, dict):
            return tool_call.get("name", "unknown"), tool_call.get("args", {})
        return (
            getattr(tool_call, "name", None) or getattr(tool_call, "type", "unknown"),
            getattr(tool_call, "args", None) or getattr(tool_call, "arguments", {}),
        )

    def _execute_tool(
        self, tool_name: str, tool_args: dict, role_tools: List[BaseTool]
    ) -> Optional[str]:
        """Execute a single tool by name from role-specific tools."""
        for tool in role_tools:
            if tool.name == tool_name:
                start_time = time.time()
                # Emit tool start log
                args_preview = str(tool_args)[:80] + "..." if len(str(tool_args)) > 80 else str(tool_args)
                self._emit_log('tool_start', f"Calling tool: {tool_name}", {'args': args_preview})
                
                try:
                    logger.info(f"   └─ Executing {tool_name}...")
                    result = tool.invoke(tool_args)
                    duration = time.time() - start_time
                    self._record_tool_call(tool_name, duration, True)
                    
                    # Emit tool end log
                    result_preview = str(result)[:100] + "..." if len(str(result)) > 100 else str(result)
                    self._emit_log('tool_end', f"Tool {tool_name} completed ({duration:.1f}s)", {'result': result_preview})
                    
                    return result
                except Exception as e:
                    duration = time.time() - start_time
                    self._record_tool_call(tool_name, duration, False, type(e).__name__)
                    self._emit_log('error', f"Tool {tool_name} failed: {str(e)[:80]}")
                    logger.error(f"   └─ Tool error: {e}")
                    return f"Error executing {tool_name}: {e}"

        logger.warning(f"   └─ Tool '{tool_name}' not found in role tools")
        self._emit_log('warning', f"Tool '{tool_name}' not found")
        return None

    def _execute_without_tools(
        self,
        role: Role,
        system_msg: SystemMessage,
        task_msg: HumanMessage,
        config: RunnableConfig,
        task: str,
        depth: int,
        max_depth: int,
        process_query_callback: Optional[Callable],
        agent_id: str = "",
    ) -> Dict[str, Any]:
        """Execute agent without tools."""
        response = self._invoke_llm([system_msg, task_msg], config)
        self._track_tokens(response, agent_id, role.name)  # Track token usage
        response_content = str(response.content)

        # Check for delegation
        if role.can_delegate and depth < max_depth and process_query_callback:
            delegation_result = self._handle_delegation(
                response_content, task, system_msg, config, depth, max_depth, process_query_callback, agent_id, role.name
            )
            if delegation_result:
                return delegation_result

        return {"content": response_content, "tool_calls": [], "references": []}

    def _handle_delegation(
        self,
        response_content: str,
        task: str,
        system_msg: SystemMessage,
        config: RunnableConfig,
        depth: int,
        max_depth: int,
        process_query_callback: Callable,
        agent_id: str = "",
        role_name: str = "",
    ) -> Optional[Dict[str, Any]]:
        """Handle delegation requests from agents."""
        try:
            delegation_data = json.loads(response_content)
            if not delegation_data.get("needs_delegation") or not delegation_data.get("subtasks"):
                return None

            logger.info(f"🔀 Delegating to {len(delegation_data['subtasks'])} sub-agents")

            sub_results = []
            all_references = []
            for subtask_spec in delegation_data["subtasks"]:
                sub_role_name = subtask_spec.get("role")
                sub_task = subtask_spec.get("task")

                if not sub_role_name or not sub_task:
                    continue

                logger.info(f"  └─ Delegating to {sub_role_name}: {sub_task[:60]}...")
                sub_result = process_query_callback(sub_task, depth=depth + 1, max_depth=max_depth)
                sub_results.append(f"{sub_role_name}: {sub_result['final_answer']}")
                # Collect references from sub-agents
                if sub_result.get('references'):
                    all_references.extend(sub_result['references'])

            if sub_results:
                synthesis_msg = HumanMessage(
                    content=f"""Original task: {task}

Sub-agent results:
{chr(10).join([f"{i+1}. {r}" for i, r in enumerate(sub_results)])}

Combine these results to complete your original task."""
                )

                final_response = self._invoke_llm([system_msg, synthesis_msg], config)
                self._track_tokens(final_response, agent_id, role_name)  # Track token usage
                return {"content": str(final_response.content), "tool_calls": [], "references": all_references}

        except json.JSONDecodeError:
            pass

        return None
