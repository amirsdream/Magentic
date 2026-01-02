"""Meta-agent system - dynamically creates and executes agents based on coordinator's plan."""

import logging
import json
import asyncio
from typing import Dict, Any, List, Optional, Callable
from pathlib import Path

from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_core.tools import BaseTool
from langchain_core.runnables import RunnableConfig
from langchain_core.language_models import BaseChatModel
from langchain_ollama import ChatOllama
from langchain_openai import ChatOpenAI

try:
    from langchain_anthropic import ChatAnthropic  # type: ignore[import-not-found]

    HAS_ANTHROPIC = True
except ImportError:
    HAS_ANTHROPIC = False
    ChatAnthropic = None  # type: ignore[assignment,misc]

from .config import Config
from .coordinator.planner import MetaCoordinator
from .role_library import RoleLibrary
from .ui.visualization import ExecutionVisualizer
from .agents.token_tracker import get_tracker
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .services.rag import RAGService
    from .tools.manager import ToolManager

logger = logging.getLogger(__name__)


class MetaAgentSystem:
    """Dynamic meta-agent system."""

    def __init__(
        self,
        config: Config,
        tools: List[BaseTool],
        rag_service: Optional["RAGService"] = None,
        tool_manager: Optional["ToolManager"] = None,
    ):
        """Initialize meta-agent system.

        Args:
            config: Application configuration.
            tools: Available tools.
            rag_service: Optional RAG service for active knowledge retrieval.
            tool_manager: Optional tool manager for MCP tools.
        """
        self.config = config
        self.tools = tools
        self.rag_service = rag_service
        self.tool_manager = tool_manager
        self.role_library = RoleLibrary()

        # Initialize LLM based on provider
        self.llm = self._initialize_llm(config)
        logger.info(f"✓ Initialized {config.llm_provider} LLM: {self.llm.__class__.__name__}")

        # Initialize coordinator with the configured LLM and RAG service
        self.coordinator = MetaCoordinator(config, self.llm, rag_service=rag_service)

        # Conversation memory - per session
        self.conversation_history: List[Dict[str, str]] = []  # Legacy: default/global history
        self._session_histories: Dict[str, List[Dict[str, str]]] = {}  # Per-session histories
        self._current_session_id: Optional[str] = None  # Track current session
        # Visualization
        self.visualizer = ExecutionVisualizer()
        # Hierarchical execution settings from config
        self.max_delegation_depth = config.max_delegation_depth
        self.absolute_max_depth = config.absolute_max_depth
        self.max_subtasks_per_delegation = config.max_subtasks_per_delegation
        self.max_total_delegations = config.max_total_delegations
        self._delegation_counter = 0  # Tracks total delegations per root query
        # Concurrency control - limit parallel agents to prevent system overload
        self.max_parallel_agents = config.max_parallel_agents
        self._semaphore = asyncio.Semaphore(self.max_parallel_agents)
        
        # Streaming callback for final agent response
        self._stream_callback: Optional[Callable[[str], Any]] = None
        self._stream_agent_id: Optional[str] = None  # Which agent should stream

    def set_stream_callback(self, callback: Optional[Callable[[str], Any]], agent_id: Optional[str] = None) -> None:
        """Set callback for streaming final agent response.
        
        Args:
            callback: Async function(token: str) to call for each token
            agent_id: Optional agent ID that should stream (last agent)
        """
        self._stream_callback = callback
        self._stream_agent_id = agent_id

    def set_session(self, session_id: Optional[str]) -> None:
        """Set the current session and switch conversation history.
        
        Args:
            session_id: Session ID to switch to, or None for default history
        """
        self._current_session_id = session_id
        if session_id:
            # Initialize session history if not exists
            if session_id not in self._session_histories:
                self._session_histories[session_id] = []
            # Point conversation_history to session-specific history
            self.conversation_history = self._session_histories[session_id]
            logger.info(f"📚 Switched to session {session_id} with {len(self.conversation_history)} messages")
        else:
            # Use default/global history
            self.conversation_history = []
            logger.info("📚 Using default conversation history")

    def load_session_history(self, session_id: str, messages: List[Dict[str, str]]) -> None:
        """Load conversation history for a session from database.
        
        Args:
            session_id: Session ID
            messages: List of message dicts with 'role' and 'content'
        """
        self._session_histories[session_id] = messages.copy()
        if self._current_session_id == session_id:
            self.conversation_history = self._session_histories[session_id]
        logger.info(f"📚 Loaded {len(messages)} messages for session {session_id}")

    def get_session_history(self, session_id: Optional[str] = None) -> List[Dict[str, str]]:
        """Get conversation history for a session.
        
        Args:
            session_id: Session ID, or None for current session
            
        Returns:
            List of conversation messages
        """
        sid = session_id or self._current_session_id
        if sid and sid in self._session_histories:
            return self._session_histories[sid]
        return self.conversation_history

    def clear_session_history(self, session_id: Optional[str] = None) -> None:
        """Clear conversation history for a session.
        
        Args:
            session_id: Session ID to clear, or None for current session
        """
        sid = session_id or self._current_session_id
        if sid and sid in self._session_histories:
            self._session_histories[sid] = []
            if self._current_session_id == sid:
                self.conversation_history = self._session_histories[sid]
            logger.info(f"🗑️ Cleared history for session {sid}")
        elif not sid:
            self.conversation_history = []
            logger.info("🗑️ Cleared default conversation history")

    def _initialize_llm(self, config: Config) -> BaseChatModel:
        """Initialize the appropriate LLM based on configuration.

        Args:
            config: Application configuration

        Returns:
            Initialized LLM instance
        """
        logger.info(f"🔧 Initializing LLM with provider: {config.llm_provider}")

        if config.llm_provider == "ollama":
            logger.info(f"   Using Ollama model: {config.ollama_model} at {config.ollama_base_url}")
            # Enable reasoning mode for thinking models (Qwen3, QwQ, DeepSeek-R1, etc.)
            # This captures thinking in additional_kwargs["reasoning_content"] instead of <think> tags
            reasoning_enabled = config.is_thinking_model()
            if reasoning_enabled:
                logger.info("   Reasoning mode ENABLED for thinking model")
            return ChatOllama(
                model=config.ollama_model,
                base_url=config.ollama_base_url,
                temperature=config.llm_temperature,
                reasoning=reasoning_enabled if reasoning_enabled else None,
            )
        elif config.llm_provider == "openai":
            logger.info(f"   Using OpenAI model: {config.openai_model}")
            if not config.openai_api_key:
                raise ValueError("OPENAI_API_KEY is required when using OpenAI provider")
            return ChatOpenAI(
                model=config.openai_model,
                api_key=config.openai_api_key if config.openai_api_key else None,  # type: ignore
                temperature=config.llm_temperature,
            )
        elif config.llm_provider == "claude":
            logger.info(f"   Using Claude model: {config.anthropic_model}")
            if not config.anthropic_api_key:
                raise ValueError("ANTHROPIC_API_KEY is required when using Claude provider")
            if not HAS_ANTHROPIC or ChatAnthropic is None:
                raise ImportError(
                    "langchain-anthropic is not installed. "
                    "Install it with: pip install langchain-anthropic"
                )
            return ChatAnthropic(
                model_name=config.anthropic_model,  # type: ignore[call-arg]
                api_key=config.anthropic_api_key,  # type: ignore[call-arg]
                temperature=config.llm_temperature,  # type: ignore[call-arg]
            )
        elif config.llm_provider == "vllm":
            logger.info(f"   Using vLLM model: {config.vllm_model} at {config.vllm_base_url}")
            # vLLM exposes an OpenAI-compatible API
            return ChatOpenAI(
                model=config.vllm_model,
                base_url=config.vllm_base_url,
                api_key=config.vllm_api_key,  # type: ignore[call-arg]
                temperature=config.llm_temperature,
            )
        else:
            raise ValueError(f"Unsupported LLM provider: {config.llm_provider}")

    def _track_tokens(self, response: Any, agent_id: str = "", role: str = "") -> None:
        """Track token usage from an LLM response.

        Args:
            response: LLM response object
            agent_id: Agent identifier
            role: Agent role name
        """
        tracker = get_tracker()

        if agent_id and role:
            tracker.add_agent_usage(agent_id, role, response)
            logger.debug(f"Tracked tokens for {agent_id} ({role})")
        else:
            # Track as general usage if no agent context
            usage = tracker.extract_usage_from_response(response)
            logger.debug(f"Tracked general tokens: {usage.to_dict()}")

    async def _invoke_with_streaming(
        self, 
        messages: list, 
        config: RunnableConfig, 
        agent_id: str,
        role_name: str
    ) -> str:
        """Invoke LLM with optional streaming for final agent.
        
        Args:
            messages: Messages to send to LLM
            config: Runnable config
            agent_id: Current agent ID
            role_name: Role name for tracking
            
        Returns:
            Response content as string
        """
        # Check if this agent should stream
        should_stream = (
            self._stream_callback is not None and 
            self._stream_agent_id == agent_id
        )
        
        if should_stream:
            logger.info(f"🌊 Streaming response for final agent: {agent_id}")
            content_parts = []
            try:
                async for chunk in self.llm.astream(messages, config=config):
                    if hasattr(chunk, 'content') and chunk.content:
                        token = chunk.content
                        # Ensure token is a string
                        if isinstance(token, list):
                            token = ''.join(str(t) if isinstance(t, str) else '' for t in token)
                        token = str(token)
                        content_parts.append(token)
                        # Call the callback with each token
                        if self._stream_callback:
                            await self._stream_callback(token)
                
                full_content = ''.join(content_parts)
                # Create a mock response for token tracking
                # Note: We can't get accurate token counts from streaming
                logger.info(f"✅ Streamed {len(full_content)} chars for {agent_id}")
                return full_content
            except Exception as e:
                logger.error(f"Streaming error for {agent_id}: {e}")
                # Fallback to non-streaming
                response = self.llm.invoke(messages, config=config)
                self._track_tokens(response, agent_id, role_name)
                return str(response.content)
        else:
            # Normal non-streaming invoke
            response = self.llm.invoke(messages, config=config)
            self._track_tokens(response, agent_id, role_name)
            return str(response.content)

    def process_query(
        self, query: str, depth: int = 0, max_depth: int | None = None
    ) -> Dict[str, Any]:
        """Process a query using dynamic agent creation.

        Args:
            query: User's query.
            depth: Current execution depth (for hierarchical delegation).
            max_depth: Maximum depth for delegation (uses config default if None).

        Returns:
            Result dictionary with final answer and execution trace.
        """
        # Enforce absolute max depth as safety guardrail
        if depth >= self.absolute_max_depth:
            logger.warning(f"🛑 Max depth {self.absolute_max_depth} reached, stopping recursion")
            return {
                "final_answer": f"Maximum execution depth ({self.absolute_max_depth}) reached. Unable to process further sub-tasks.",
                "trace": [],
                "plan": {
                    "description": "Depth limit exceeded",
                    "agents": [],
                    "execution_layers": 0,
                },
            }

        # Use config default if not specified
        if max_depth is None:
            max_depth = self.max_delegation_depth

        # Cap max_depth at absolute limit
        max_depth = min(max_depth, self.absolute_max_depth)

        # Reset delegation counter at root level
        if depth == 0:
            self._delegation_counter = 0

        indent = "  " * depth
        logger.info(f"{indent}🚀 Processing query (depth {depth}/{max_depth}): {query[:100]}...")

        # Build context from conversation history (only at root level)
        context = self._build_context() if depth == 0 else ""

        # Step 1: Coordinator creates execution plan (with history context)
        plan = self.coordinator.create_execution_plan(
            query, context, depth=depth, max_depth=max_depth
        )

        # Display execution plan as tree (only at root level)
        if depth == 0:
            self.visualizer.display_plan_tree(
                plan.description, plan.agents, depth=depth, max_depth=max_depth
            )

        # Step 2: Execute plan with DAG-based parallelization
        execution_layers = plan.get_execution_layers()
        logger.info("")
        logger.info("🔀" + "=" * 70)
        logger.info(f"🔀 PARALLEL EXECUTION: {len(execution_layers)} layers total")
        logger.info("🔀" + "=" * 70)
        for layer_idx, layer in enumerate(execution_layers):
            layer_agents = [plan.agents[i]["role"] for i in layer]
            if len(layer) > 1:
                logger.info(
                    f"🔀 Layer {layer_idx}: ⚡ {len(layer)} agents IN PARALLEL - {layer_agents}"
                )
            else:
                logger.info(f"🔀 Layer {layer_idx}: 1 agent (sequential) - {layer_agents}")
        logger.info("🔀" + "=" * 70)
        logger.info("")

        trace = []
        outputs = {}  # Dictionary keyed by agent index for dependency resolution

        # Execute layer by layer
        for layer_idx, agent_indices in enumerate(execution_layers):
            logger.info(f"\n{'='*60}")
            logger.info(
                f"🔀 LAYER {layer_idx + 1}/{len(execution_layers)}: Executing {len(agent_indices)} agents in parallel"
            )
            logger.info(f"{'='*60}")

            # Show parallel agents starting if multiple agents
            if len(agent_indices) > 1:
                layer_agent_specs = [plan.agents[i] for i in agent_indices]
                self.visualizer.display_parallel_agents_start(
                    layer_agent_specs, layer_idx + 1, len(execution_layers)
                )

            # Execute all agents in this layer in parallel
            if len(agent_indices) == 1:
                # Single agent - no parallelization needed
                i = agent_indices[0]
                output = self._execute_single_agent(
                    i,
                    plan.agents[i],
                    plan.agents,
                    outputs,
                    query,
                    depth,
                    max_depth,
                    trace,
                    layer_idx=layer_idx,
                    total_layers=len(execution_layers),
                )
                outputs[i] = output
            else:
                # Multiple agents - run in parallel using asyncio
                layer_outputs = asyncio.run(
                    self._execute_layer_parallel(
                        agent_indices,
                        plan.agents,
                        outputs,
                        query,
                        depth,
                        max_depth,
                        trace,
                        layer_idx=layer_idx,
                        total_layers=len(execution_layers),
                    )
                )
                outputs.update(layer_outputs)

            # Display layer completion
            if len(agent_indices) > 1:
                logger.info(
                    f"✅ Layer {layer_idx + 1} complete: {len(agent_indices)} agents finished"
                )
                self.visualizer.console.print(
                    f"\n[bold green]✅ Layer {layer_idx + 1}/{len(execution_layers)} complete: {len(agent_indices)} parallel agents finished[/bold green]\n"
                )

        # Final answer is the last output in execution order
        final_answer = outputs[len(plan.agents) - 1] if outputs else "No output generated"

        # Update conversation history
        self.conversation_history.append({"role": "user", "content": query})
        self.conversation_history.append({"role": "assistant", "content": final_answer})
        logger.info(f"💾 Conversation history: {len(self.conversation_history)} messages")

        # Create result
        result = {
            "final_answer": final_answer,
            "trace": trace,
            "plan": {
                "description": plan.description,
                "agents": [a["role"] for a in plan.agents],
                "execution_layers": len(execution_layers),
                "parallelization": f"{sum(len(layer) for layer in execution_layers)} total executions in {len(execution_layers)} layers",
            },
            "agents_spec": plan.agents,  # Full agent specifications with tasks and dependencies
            "execution_layers": execution_layers,  # For visualization
        }

        # Display summary
        self.visualizer.display_summary(result)

        return result

    def _execute_single_agent(
        self,
        agent_index: int,
        agent_spec: Dict[str, Any],
        all_agents: List[Dict[str, Any]],
        completed_outputs: Dict[int, str],
        query: str,
        depth: int,
        max_depth: int,
        trace: List[Dict[str, Any]],
        layer_idx: int = 0,
        total_layers: int = 1,
    ) -> str:
        """Execute a single agent and update trace.

        Args:
            agent_index: Index of this agent in the plan.
            agent_spec: Agent specification dict.
            all_agents: All agents in the plan.
            completed_outputs: Outputs from already-completed agents (keyed by index).
            query: Original query.
            depth: Current execution depth.
            max_depth: Maximum execution depth.
            trace: Execution trace list to update.
            layer_idx: Current execution layer index.
            total_layers: Total number of execution layers.

        Returns:
            Agent's output.
        """
        role_name = agent_spec.get("role")
        task = agent_spec.get("task")

        if not role_name or not task:
            logger.error(f"Invalid agent spec: {agent_spec}")
            return ""

        logger.info(f"🤖 Agent {agent_index}: {role_name.upper()}")
        logger.info(f"   Task: {task}")

        # Display progress with layer info
        self.visualizer.display_execution_progress(
            current_step=agent_index + 1,
            total_steps=len(all_agents),
            role=role_name,
            task=task,
            status="running",
            layer=layer_idx + 1,
            total_layers=total_layers,
        )

        # Get role definition
        role = self.role_library.get_role(role_name)
        if not role:
            logger.error(f"Unknown role: {role_name}")
            return ""

        # Collect outputs from dependencies
        depends_on = agent_spec.get("depends_on", [])
        previous_outputs = [completed_outputs[i] for i in depends_on if i in completed_outputs]

        # Get role definition
        role = self.role_library.get_role(role_name)
        if not role:
            error_msg = (
                f"Unknown role '{role_name}' - valid roles: {self.role_library.list_roles()}"
            )
            logger.error(f"❌ {error_msg}")
            return f"[ERROR: {error_msg}]"

        # Execute agent with agent_id for token tracking
        agent_id = f"{role_name}_{agent_index}"
        result = self._execute_agent(
            role, task, query, previous_outputs, [], depth=depth, max_depth=max_depth, agent_id=agent_id
        )

        # Extract content from dict result
        output = result.get("content", str(result)) if isinstance(result, dict) else str(result)

        # Update trace
        trace.append(
            {
                "step": agent_index,
                "role": role_name,
                "task": task,
                "depends_on": depends_on,
                "parallel": False,  # Single agent execution (not in parallel layer)
                "output": output[:200] + "..." if len(output) > 200 else output,
            }
        )

        return output

    async def _execute_agent_with_limit(
        self,
        agent_index: int,
        agent_spec: Dict[str, Any],
        all_agents: List[Dict[str, Any]],
        completed_outputs: Dict[int, str],
        query: str,
        depth: int,
        max_depth: int,
        layer_idx: int = 0,
        total_layers: int = 1,
    ) -> str:
        """Execute agent with semaphore to limit concurrency.

        Args:
            agent_index: Index of agent to execute.
            agent_spec: Agent specification.
            all_agents: All agents in the plan.
            completed_outputs: Outputs from completed agents.
            query: Original query.
            depth: Current execution depth.
            max_depth: Maximum execution depth.
            layer_idx: Current execution layer index.
            total_layers: Total number of execution layers.

        Returns:
            Agent output.
        """
        async with self._semaphore:
            logger.info(f"🔓 Agent {agent_index} acquired semaphore slot")
            result = await self._execute_agent_async(
                agent_index,
                agent_spec,
                all_agents,
                completed_outputs,
                query,
                depth,
                max_depth,
                layer_idx=layer_idx,
                total_layers=total_layers,
            )
            logger.info(f"🔒 Agent {agent_index} released semaphore slot")
            return result

    async def _execute_layer_parallel(
        self,
        agent_indices: List[int],
        all_agents: List[Dict[str, Any]],
        completed_outputs: Dict[int, str],
        query: str,
        depth: int,
        max_depth: int,
        trace: List[Dict[str, Any]],
        layer_idx: int = 0,
        total_layers: int = 1,
    ) -> Dict[int, str]:
        """Execute multiple agents in parallel using asyncio.

        Args:
            agent_indices: Indices of agents to execute in parallel.
            all_agents: All agents in the plan.
            completed_outputs: Outputs from already-completed agents.
            query: Original query.
            depth: Current execution depth.
            max_depth: Maximum execution depth.
            trace: Execution trace list to update.
            layer_idx: Current execution layer index.
            total_layers: Total number of execution layers.

        Returns:
            Dictionary mapping agent index to output.
        """
        logger.info(
            f"⚡ Executing {len(agent_indices)} agents in parallel (max {self.max_parallel_agents} concurrent)..."
        )
        agent_roles = [all_agents[i]["role"] for i in agent_indices]
        logger.info(f"⚡ Layer {layer_idx + 1} agents: {agent_roles}")

        # Create async tasks with semaphore limiting
        tasks = []
        for i in agent_indices:
            task = asyncio.create_task(
                self._execute_agent_with_limit(
                    i,
                    all_agents[i],
                    all_agents,
                    completed_outputs,
                    query,
                    depth,
                    max_depth,
                    layer_idx=layer_idx,
                    total_layers=total_layers,
                )
            )
            tasks.append((i, task))

        # Wait for all tasks to complete
        results = {}
        for i, task in tasks:
            output = await task
            results[i] = output

            # Update trace
            agent_spec = all_agents[i]
            trace.append(
                {
                    "step": i,
                    "role": agent_spec.get("role"),
                    "task": agent_spec.get("task"),
                    "depends_on": agent_spec.get("depends_on", []),
                    "parallel": True,
                    "output": output[:200] + "..." if len(output) > 200 else output,
                }
            )

        return results

    async def _execute_agent_async(
        self,
        agent_index: int,
        agent_spec: Dict[str, Any],
        all_agents: List[Dict[str, Any]],
        completed_outputs: Dict[int, str],
        query: str,
        depth: int,
        max_depth: int,
        layer_idx: int = 0,
        total_layers: int = 1,
    ) -> str:
        """Async wrapper for executing an agent.

        Args:
            agent_index: Index of this agent.
            agent_spec: Agent specification.
            all_agents: All agents in the plan.
            completed_outputs: Outputs from completed agents.
            query: Original query.
            depth: Current execution depth.
            max_depth: Maximum execution depth.
            layer_idx: Current execution layer index.
            total_layers: Total number of execution layers.

        Returns:
            Agent's output.
        """
        role_name = agent_spec.get("role")
        task = agent_spec.get("task")

        if not role_name or not task:
            logger.error(f"Invalid agent spec: {agent_spec}")
            return ""

        logger.info(f"⚡ [PARALLEL Layer {layer_idx + 1}] Agent {agent_index}: {role_name.upper()}")

        # Get role definition
        role = self.role_library.get_role(role_name)
        if not role:
            logger.error(f"Unknown role: {role_name}")
            return ""

        # Collect outputs from dependencies
        depends_on = agent_spec.get("depends_on", [])
        previous_outputs = [completed_outputs[i] for i in depends_on if i in completed_outputs]

        # Execute in thread pool to avoid blocking (LLM calls are blocking)
        agent_id = f"{role_name}_{agent_index}"
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None, self._execute_agent, role, task, query, previous_outputs, [], depth, max_depth, agent_id
        )

        # Extract content from dict result
        output = result.get("content", str(result)) if isinstance(result, dict) else str(result)

        logger.info(f"✅ [PARALLEL] Agent {agent_index} completed: {role_name.upper()}")

        return output

    async def execute_agent_for_langgraph(
        self,
        agent_id: str,
        role: str,
        task: str,
        context: str,
        original_query: str,
        layer: int = 0,
        total_layers: int = 1,
        agent_number: int = 1,
        total_agents: int = 1,
        conversation_history: Optional[List[Dict[str, str]]] = None,
    ) -> Dict[str, Any]:
        """Execute a single agent for LangGraph integration.

        This is a simplified async interface for LangGraph nodes.

        Args:
            agent_id: Unique agent identifier
            role: Agent role name
            task: Task for the agent
            context: Context from dependencies
            original_query: The original user query
            layer: Current layer index
            total_layers: Total number of layers
            agent_number: Agent number in overall sequence (1-indexed)
            total_agents: Total number of agents

        Returns:
            Dict with 'content' (agent's text output) and 'tool_calls' (list of tools used)
        """
        # Get role definition
        role_obj = self.role_library.get_role(role)
        if not role_obj:
            logger.error(f"Unknown role: {role}")
            return {"content": f"[ERROR: Unknown role '{role}']", "tool_calls": []}

        # Display progress
        self.visualizer.display_execution_progress(
            current_step=agent_number,
            total_steps=total_agents,
            role=role,
            task=task,
            status="running",
            layer=layer + 1,  # 1-indexed for display
            total_layers=total_layers,
        )

        # Parse context to extract previous outputs
        previous_outputs = []
        if context:
            logger.info(f"Agent {agent_id} received context ({len(context)} chars)")
            logger.debug(f"Context raw repr: {repr(context[:200])}")

            # Context format: "From agent_id:\noutput\n\nFrom agent_id2:\noutput2"
            # Use regex to split on "From <agent_id>:" pattern to handle multi-paragraph outputs
            import re

            # Pattern matches "From <word>_<number>:" at the start of a line
            agent_pattern = re.compile(r"(?:^|\n\n)From ([a-zA-Z_]+_\d+):\n", re.MULTILINE)

            # Find all agent headers and their positions
            matches = list(agent_pattern.finditer(context))
            logger.info(f"Found {len(matches)} agent outputs in context")

            if matches:
                for i, match in enumerate(matches):
                    agent_name = match.group(1)
                    start_pos = match.end()  # Position after the header

                    # End position is either start of next match or end of string
                    if i + 1 < len(matches):
                        end_pos = matches[i + 1].start()
                    else:
                        end_pos = len(context)

                    output = context[start_pos:end_pos].strip()
                    if output:
                        previous_outputs.append(output)
                        logger.info(
                            f"Extracted output from {agent_name} ({len(output)} chars): {output[:200]}..."
                        )
                    else:
                        logger.warning(f"Agent {agent_name} has empty output")
            else:
                # Fallback: no pattern found, treat entire context as single input
                # (This handles edge cases or different formats)
                logger.warning(f"No 'From agent_id:' pattern found, using raw context")
                if context.strip() and not context.startswith("Original question:"):
                    previous_outputs.append(context.strip())

            logger.info(f"Total previous outputs extracted: {len(previous_outputs)}")
        else:
            logger.info(f"Agent {agent_id} has no context (first agent)")

        # Add conversation history context if available
        if conversation_history:
            logger.info(
                f"Agent {agent_id} has access to {len(conversation_history)} previous conversation steps"
            )

        # Ensure conversation_history is a list (not None) for thread pool
        conv_hist = conversation_history if conversation_history is not None else []

        # Check if this is the final agent that should stream
        # BUT only stream if the role doesn't need tools - streaming bypasses tool execution!
        should_stream = (
            self._stream_callback is not None and 
            self._stream_agent_id == agent_id and
            not role_obj.needs_tools  # Don't stream if agent needs tools
        )
        
        if should_stream:
            # Use async streaming path for final agent (only if no tools needed)
            logger.info(f"🌊 Using streaming execution for final agent: {agent_id}")
            result = await self._execute_agent_streaming(
                role_obj,
                task,
                original_query,
                previous_outputs,
                conv_hist,
                agent_id,
            )
        else:
            # Log why not streaming if it was the target agent
            if self._stream_callback and self._stream_agent_id == agent_id and role_obj.needs_tools:
                logger.info(f"⚠️ Agent {agent_id} needs tools, using non-streaming execution with full tool support")
            
            # Execute in thread pool - pass agent_id for token tracking
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None,
                self._execute_agent,
                role_obj,
                task,
                original_query,
                previous_outputs,
                conv_hist,
                0,
                3,
                agent_id,  # Pass agent_id for token tracking
            )

        logger.info(f"✅ {agent_id} ({role}) completed")
        return result
    
    async def _execute_agent_streaming(
        self,
        role,
        task: str,
        original_query: str,
        previous_outputs: List[str],
        conversation_history: Optional[List[Dict[str, str]]] = None,
        agent_id: str = "",
    ) -> Dict[str, Any]:
        """Execute an agent with streaming output.
        
        This is used for the final agent to stream response tokens in real-time.
        
        Args:
            role: Agent role definition.
            task: Specific task for this agent.
            original_query: Original user query.
            previous_outputs: Outputs from previous agents.
            conversation_history: Previous conversation steps.
            agent_id: Agent identifier.
            
        Returns:
            Dict with 'content' (agent's text output) and 'tool_calls' (empty for streaming).
        """
        from langchain_core.messages import SystemMessage, HumanMessage
        
        # Build context
        context_parts = [f"Original question: {original_query}"]
        
        # Add conversation history from previous steps if available
        if conversation_history:
            context_parts.append("\n=== Previous Agent Conversation Steps ===")
            for i, step in enumerate(conversation_history[-3:], 1):
                context_parts.append(
                    f"\nStep {i} - {step.get('role', 'unknown')} ({step.get('agent_id', '')}):"
                )
                context_parts.append(f"  Task: {step.get('task', '')[:200]}")
                step_output = step.get("output", "")
                output_preview = (
                    step_output[:self.config.agent_history_limit] + "..."
                    if len(step_output) > self.config.agent_history_limit
                    else step_output
                )
                context_parts.append(f"  Output: {output_preview}")
        
        # Add user conversation history if available
        if self.conversation_history:
            context_parts.append("\nConversation history (recent):")
            recent = self.conversation_history[-4:]
            for msg in recent:
                role_label = "User" if msg["role"] == "user" else "Assistant"
                content = (
                    msg["content"][:150] + "..." if len(msg["content"]) > 150 else msg["content"]
                )
                context_parts.append(f"  {role_label}: {content}")
        
        if previous_outputs:
            context_parts.append("\n=== Outputs from Previous Agents ===")
            for i, output in enumerate(previous_outputs, 1):
                output_display = (
                    output[:self.config.agent_context_limit] + "... [truncated]"
                    if len(output) > self.config.agent_context_limit
                    else output
                )
                context_parts.append(f"\nAgent {i} output:\n{output_display}")
        else:
            context_parts.append("\n=== You are the first agent ===")
            context_parts.append("No prior agent outputs available yet.")
        
        context = "\n".join(context_parts)
        
        # Build messages
        output_limit_instruction = f"\n\nIMPORTANT: Keep your response concise and under {self.config.ui_display_limit} characters. Be direct and focused."
        system_msg = SystemMessage(content=role.system_prompt + output_limit_instruction)
        task_msg = HumanMessage(content=f"{context}\n\nYour task: {task}")
        
        # Add metadata for Phoenix tracing
        metadata = {"agent_role": role.name, "agent_task": task, "streaming": True}
        config: RunnableConfig = {
            "run_name": f"{role.name}_agent_streaming",
            "metadata": metadata,
            "tags": [role.name, "meta_agent", "streaming"],
        }
        
        messages = [system_msg, task_msg]
        
        # Use streaming invocation
        content = await self._invoke_with_streaming(messages, config, agent_id, role.name)
        
        return {
            "content": content,
            "tool_calls": [],  # Tools not supported in streaming mode
            "artifacts": [],
        }

    def _execute_agent(
        self,
        role,
        task: str,
        original_query: str,
        previous_outputs: List[str],
        conversation_history: Optional[List[Dict[str, str]]] = None,
        depth: int = 0,
        max_depth: int = 3,
        agent_id: str = "",
    ) -> Dict[str, Any]:
        """Execute a single agent.

        Args:
            role: Agent role definition.
            task: Specific task for this agent.
            original_query: Original user query.
            previous_outputs: Outputs from previous agents.
            depth: Current execution depth.
            max_depth: Maximum execution depth for this query.
            agent_id: Agent identifier for token tracking.

        Returns:
            Dict with 'content' (agent's text output) and 'tool_calls' (list of tools used).
        """
        # Build context
        context_parts = [f"Original question: {original_query}"]

        # Add conversation history from previous steps if available
        if conversation_history:
            context_parts.append("\n=== Previous Agent Conversation Steps ===")
            history_limit = self.config.agent_history_limit
            for i, step in enumerate(conversation_history[-3:], 1):  # Last 3 steps for context
                context_parts.append(
                    f"\nStep {i} - {step.get('role', 'unknown')} ({step.get('agent_id', '')}):"
                )
                context_parts.append(f"  Task: {step.get('task', '')[:200]}")
                step_output = step.get("output", "")
                output_preview = (
                    step_output[:history_limit] + "..."
                    if len(step_output) > history_limit
                    else step_output
                )
                context_parts.append(f"  Output: {output_preview}")

        # Add user conversation history if available (from meta_system.conversation_history)
        if self.conversation_history:
            context_parts.append("\nConversation history (recent):")
            # Last 2 exchanges (4 messages)
            recent = self.conversation_history[-4:]
            for msg in recent:
                role_label = "User" if msg["role"] == "user" else "Assistant"
                content = (
                    msg["content"][:150] + "..." if len(msg["content"]) > 150 else msg["content"]
                )
                context_parts.append(f"  {role_label}: {content}")

        if previous_outputs:
            logger.info(f"Agent has {len(previous_outputs)} previous outputs to incorporate")
            context_parts.append("\n=== Outputs from Previous Agents ===")
            context_limit = self.config.agent_context_limit
            for i, output in enumerate(previous_outputs, 1):
                # Truncate based on config (preserve context for multi-agent flows)
                output_display = (
                    output[:context_limit] + "... [truncated]"
                    if len(output) > context_limit
                    else output
                )
                context_parts.append(f"\nAgent {i} output:\n{output_display}")
                logger.info(f"Adding previous output {i} ({len(output)} chars): {output[:300]}...")
        else:
            logger.info("Agent is the first agent - no previous outputs")
            context_parts.append("\n=== You are the first agent ===")
            context_parts.append("No prior agent outputs available yet.")

        context = "\n".join(context_parts)
        logger.info(f"Built context for agent (length: {len(context)})")

        # Build messages with output length constraint
        output_limit_instruction = f"\n\nIMPORTANT: Keep your response concise and under {self.config.ui_display_limit} characters. Be direct and focused."
        system_msg = SystemMessage(content=role.system_prompt + output_limit_instruction)
        task_msg = HumanMessage(content=f"{context}\n\nYour task: {task}")

        logger.info(f"Task message content (first 500 chars): {task_msg.content[:500]}...")

        # Check if agent can and should delegate
        if role.can_delegate and depth < max_depth:
            # Add delegation instructions
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

IMPORTANT: If completing directly, keep your response under {self.config.ui_display_limit} characters - be concise and focused.
"""
            task_msg = HumanMessage(content=delegation_prompt)

        # Add metadata for Phoenix tracing
        metadata = {"agent_role": role.name, "agent_task": task, "has_tools": role.needs_tools}
        config: RunnableConfig = {
            "run_name": f"{role.name}_agent",  # Unique name in Phoenix
            "metadata": metadata,
            "tags": [role.name, "meta_agent"],
        }  # type: ignore

        # Execute with or without tools
        if role.needs_tools:
            # Check if tools are available
            if not self.tools:
                logger.error(f"⚠️ {role.name} needs tools but no tools are available!")
                logger.warning(f"Falling back to LLM without tools")
                response = self.llm.invoke([system_msg, task_msg], config=config)
                self._track_tokens(response, agent_id, role.name)
                return {"content": str(response.content), "tool_calls": []}

            # Special handling for researcher role - more reliable than tool calling
            if role.name == "researcher":
                logger.info(
                    f"🔍 {role.name} will perform web search (available tools: {[t.name for t in self.tools]})"
                )

                # First, ask the LLM what to search for
                search_prompt = SystemMessage(
                    content=f"""You are a research specialist planning a web search.
Based on the task, provide 1-3 search queries (one per line) that would give the best results.
Just output the search queries, nothing else. No explanations, no numbering.

IMPORTANT: Keep search queries short and focused."""
                )

                search_response = self.llm.invoke([search_prompt, task_msg], config=config)
                self._track_tokens(search_response, agent_id, role.name)
                search_queries = str(search_response.content).strip().split("\n")
                search_queries = [q.strip() for q in search_queries if q.strip()][
                    :3
                ]  # Max 3 queries

                logger.info(f"   └─ Search queries: {search_queries}")

                # Execute searches
                tool_results = []
                search_tool_found = False
                for tool in self.tools:
                    if tool.name in ["duckduckgo_search", "ddg-search"]:
                        search_tool_found = True
                        logger.info(f"   └─ Found search tool: {tool.name}")
                        break

                if not search_tool_found:
                    logger.error(
                        f"   └─ No DuckDuckGo search tool found! Available: {[t.name for t in self.tools]}"
                    )
                    logger.warning(f"   └─ Falling back to LLM without search")
                    response = self.llm.invoke([system_msg, task_msg], config=config)
                    self._track_tokens(response, agent_id, role.name)
                    return {"content": str(response.content), "tool_calls": []}

                for query in search_queries:
                    # Clean query (remove numbering, bullets, etc.)
                    query = query.lstrip("0123456789.-) ").strip()
                    if not query:
                        logger.warning(f"   └─ Skipping empty query after cleaning")
                        continue

                    for tool in self.tools:
                        if tool.name in ["duckduckgo_search", "ddg-search"]:
                            try:
                                logger.info(f"   └─ Searching: {query}")
                                result = tool.invoke({"query": query})
                                if result:
                                    tool_results.append(result)
                                    logger.info(f"=" * 60)
                                    logger.info(f"🔍 SEARCH RESULT for '{query}':")
                                    logger.info(f"=" * 60)
                                    logger.info(
                                        result[:500] + "..." if len(result) > 500 else result
                                    )
                                    logger.info(f"=" * 60)
                                else:
                                    logger.warning(
                                        f"   └─ Search returned empty result for '{query}'"
                                    )
                            except Exception as e:
                                logger.error(f"   └─ Search error for '{query}': {e}")
                                import traceback

                                logger.error(traceback.format_exc())
                                tool_results.append(f"Search failed for '{query}': {e}")
                            break

                # Get final response with search results
                if tool_results:
                    tool_context = "\n\n".join(
                        [f"Search result {i+1}:\n{r}" for i, r in enumerate(tool_results)]
                    )
                    logger.info(f"📥 {role.name} processing {len(tool_results)} search result(s)")
                    logger.info(f"📝 Context length: {len(tool_context)} chars")

                    final_response = self.llm.invoke(
                        [
                            system_msg,
                            task_msg,
                            AIMessage(
                                content=f"Based on these search results:\n\n{tool_context}\n\nProvide a comprehensive research summary. Keep it under {self.config.ui_display_limit} characters - be concise and focused on key findings."
                            ),
                        ],
                        config=config,
                    )
                    self._track_tokens(final_response, agent_id, role.name)

                    # Debug: check response structure
                    logger.info(f"🔍 Response type: {type(final_response)}")
                    logger.info(f"🔍 Response attributes: {dir(final_response)}")
                    logger.info(f"🔍 Response content type: {type(final_response.content)}")
                    logger.info(f"🔍 Response content repr: {repr(final_response.content)}")

                    result_content = str(final_response.content)
                    logger.info(f"✅ {role.name} generated response: {len(result_content)} chars")

                    if not result_content or len(result_content) == 0:
                        logger.error(
                            f"❌ LLM returned empty content! Full response: {final_response}"
                        )
                        # Fallback: try without the search context
                        logger.warning(f"⚠️ Retrying without search context...")
                        fallback = self.llm.invoke([system_msg, task_msg], config=config)
                        self._track_tokens(fallback, agent_id, role.name)
                        result_content = str(fallback.content)
                        logger.info(f"✅ Fallback response: {len(result_content)} chars")

                    # Return dict with content and tool info for researcher
                    return {
                        "content": result_content,
                        "tool_calls": [
                            {"name": "duckduckgo_search", "args": {"query": q}}
                            for q in search_queries
                        ],
                    }
                else:
                    logger.warning(f"⚠️ No search results obtained, providing answer without search")
                    response = self.llm.invoke([system_msg, task_msg], config=config)
                    self._track_tokens(response, agent_id, role.name)
                    result_content = str(response.content)
                    logger.info(
                        f"✅ {role.name} generated fallback response: {len(result_content)} chars"
                    )
                    return {"content": result_content, "tool_calls": []}

            # Fallback to standard tool calling for other tool-enabled roles
            llm_with_tools = self.llm.bind_tools(self.tools)
            logger.info(f"🔧 {role.name} has access to web search")

            response = llm_with_tools.invoke([system_msg, task_msg], config=config)
            self._track_tokens(response, agent_id, role.name)

            # Check for tool calls
            if hasattr(response, "tool_calls") and response.tool_calls:
                logger.info(f"🔍 {role.name} is calling {len(response.tool_calls)} tool(s)")

                # Store tool calls for later reporting
                recorded_tool_calls = []

                # Execute tools
                tool_results = []
                for tool_call in response.tool_calls:
                    # Handle different tool_call formats
                    if isinstance(tool_call, dict):
                        tool_name = tool_call.get("name", "unknown")
                        tool_args = tool_call.get("args", {})
                    else:
                        tool_name = getattr(tool_call, "name", None) or getattr(
                            tool_call, "type", "unknown"
                        )
                        tool_args = getattr(tool_call, "args", None) or getattr(
                            tool_call, "arguments", {}
                        )

                    # Record this tool call
                    recorded_tool_calls.append({"name": tool_name, "args": tool_args})

                    logger.info(f"   └─ Tool: {tool_name}")
                    logger.info(f"   └─ Args: {tool_args}")
                    logger.debug(f"   └─ Full tool_call: {tool_call}")

                    # Validate and clean tool args
                    if isinstance(tool_args, dict):
                        # Check if we got a schema instead of actual args (common LLM mistake)
                        if "properties" in tool_args or "type" in tool_args:
                            logger.warning(
                                f"   └─ LLM returned schema instead of args, attempting extraction..."
                            )
                            # Try to extract actual query from various possible locations
                            if "query" in tool_args and isinstance(tool_args["query"], str):
                                tool_args = {"query": tool_args["query"]}
                            else:
                                logger.error(f"   └─ Could not extract valid query from schema")
                                tool_results.append(
                                    f"Error: LLM provided schema instead of actual search query"
                                )
                                continue

                    # Find and execute tool
                    tool_found = False
                    for tool in self.tools:
                        if tool.name == tool_name:
                            tool_found = True
                            try:
                                logger.info(f"   └─ Executing {tool_name}...")
                                result = tool.invoke(tool_args)
                                tool_results.append(result)
                                logger.info(f"=" * 60)
                                logger.info(f"🔍 WEB SEARCH RESULT:")
                                logger.info(f"=" * 60)
                                logger.info(result)
                                logger.info(f"=" * 60)
                            except Exception as e:
                                logger.error(f"   └─ Tool error: {e}")
                                tool_results.append(f"Error executing {tool_name}: {e}")

                    if not tool_found:
                        logger.warning(f"   └─ Tool '{tool_name}' not found in available tools")
                        logger.info(f"   └─ Available tools: {[t.name for t in self.tools]}")

                # Get final response with tool results
                if tool_results:
                    tool_context = "\n\n".join(
                        [f"Search result {i+1}:\n{r}" for i, r in enumerate(tool_results)]
                    )
                    logger.info(f"📥 {role.name} processing {len(tool_results)} tool result(s)")
                    final_config: RunnableConfig = {
                        "run_name": f"{role.name}_synthesize",
                        "metadata": {**metadata, "processing_tool_results": True},
                        "tags": [role.name, "synthesis", "meta_agent"],
                    }  # type: ignore
                    final_response = self.llm.invoke(
                        [
                            system_msg,
                            task_msg,
                            AIMessage(
                                content=f"Based on these search results:\n\n{tool_context}\n\nProvide a comprehensive answer."
                            ),
                        ],
                        config=final_config,
                    )
                    self._track_tokens(final_response, agent_id, role.name)
                    return {
                        "content": str(final_response.content),
                        "tool_calls": recorded_tool_calls,
                    }

            return {"content": str(response.content), "tool_calls": []}
        else:
            response = self.llm.invoke([system_msg, task_msg], config=config)
            self._track_tokens(response, agent_id, role.name)
            response_content = str(response.content)

            # Check if delegation was requested (and is allowed)
            if role.can_delegate and depth < max_depth:
                # Check total delegation limit
                if self._delegation_counter >= self.max_total_delegations:
                    logger.warning(
                        f"⚠️ Max total delegations ({self.max_total_delegations}) reached, "
                        f"returning direct response"
                    )
                    return {"content": response_content, "tool_calls": []}

                try:
                    # Try to parse as JSON delegation request
                    delegation_data = json.loads(response_content)
                    if delegation_data.get("needs_delegation") and delegation_data.get("subtasks"):
                        subtasks = delegation_data["subtasks"]

                        # Limit number of subtasks
                        if len(subtasks) > self.max_subtasks_per_delegation:
                            logger.warning(
                                f"⚠️ Limiting subtasks from {len(subtasks)} to {self.max_subtasks_per_delegation}"
                            )
                            subtasks = subtasks[: self.max_subtasks_per_delegation]

                        logger.info(
                            f"🔀 {role.name} is delegating to {len(subtasks)} sub-agents "
                            f"(depth {depth+1}, total delegations: {self._delegation_counter + 1})"
                        )

                        # Increment delegation counter
                        self._delegation_counter += 1

                        # Execute sub-agents recursively
                        sub_results = []
                        for subtask_spec in subtasks:
                            # Check limit again before each subtask
                            if self._delegation_counter >= self.max_total_delegations:
                                logger.warning(
                                    f"⚠️ Stopping delegation: max total ({self.max_total_delegations}) reached"
                                )
                                break

                            sub_role_name = subtask_spec.get("role")
                            sub_task = subtask_spec.get("task")

                            if not sub_role_name or not sub_task:
                                continue

                            logger.info(f"  └─ Delegating to {sub_role_name}: {sub_task[:60]}...")

                            # Process sub-query recursively with same max_depth
                            sub_result = self.process_query(
                                sub_task, depth=depth + 1, max_depth=max_depth
                            )
                            sub_results.append(f"{sub_role_name}: {sub_result['final_answer']}")

                        # Synthesize sub-results
                        if sub_results:
                            synthesis_msg = HumanMessage(
                                content=f"""Original task: {task}

Sub-agent results:
{chr(10).join([f"{i+1}. {r}" for i, r in enumerate(sub_results)])}

Combine these results to complete your original task."""
                            )

                            final_response = self.llm.invoke(
                                [system_msg, synthesis_msg], config=config
                            )
                            self._track_tokens(final_response, agent_id, role.name)
                            return {"content": str(final_response.content), "tool_calls": []}
                except json.JSONDecodeError:
                    # Not JSON, return as-is
                    pass

            return {"content": response_content, "tool_calls": []}

    def _build_context(self) -> str:
        """Build conversation context from history.

        Returns:
            Formatted conversation history with FULL content.
        """
        if not self.conversation_history:
            return ""

        # Include ALL conversation history for full context
        # The coordinator needs complete history to understand references
        lines = []
        for i, msg in enumerate(self.conversation_history):
            role_label = "User" if msg["role"] == "user" else "Assistant"
            content = msg["content"]
            # Include full content, not truncated
            lines.append(f"[{i+1}] {role_label}: {content}")

        return "\n\n".join(lines) if lines else ""

    def clear_memory(self) -> None:
        """Clear conversation history."""
        self.conversation_history.clear()
        logger.info("💾 Conversation memory cleared")

    def get_memory_summary(self) -> Dict[str, Any]:
        """Get conversation memory summary.

        Returns:
            Summary with message count and preview.
        """
        return {
            "message_count": len(self.conversation_history),
            "exchanges": len(self.conversation_history) // 2,
            "preview": self.conversation_history[-2:] if self.conversation_history else [],
        }

    def generate_execution_graph(self, result: Dict[str, Any], auto_open: bool = True) -> str:
        """Generate interactive HTML graph of last execution.

        Args:
            result: Execution result dictionary.
            auto_open: Whether to auto-open in browser.

        Returns:
            Path to generated HTML file.
        """
        graph_path = self.visualizer.create_execution_graph(
            plan_description=result["plan"]["description"],
            agents=result.get(
                "agents_spec",
                [{"role": r, "task": "", "depends_on": []} for r in result["plan"]["agents"]],
            ),
            trace=result["trace"],
            execution_layers=result.get("execution_layers"),
        )

        if auto_open:
            import webbrowser

            webbrowser.open(f"file://{Path(graph_path).absolute()}")
            logger.info("🌐 Opened graph in browser")

        return graph_path

    def show_memory_visualization(self) -> None:
        """Display conversation memory visualization."""
        self.visualizer.show_memory_visualization(self.conversation_history)
