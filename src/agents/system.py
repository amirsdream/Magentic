"""Meta-agent system - dynamically creates and executes agents based on coordinator's plan."""

import asyncio
import logging
from typing import Dict, Any, List, Optional, TYPE_CHECKING, Callable
from pathlib import Path

from langchain_core.tools import BaseTool

from ..config import Config
from ..role_library import RoleLibrary
from ..coordinator import MetaCoordinator
from ..ui import ExecutionVisualizer
from .llm_factory import create_llm
from .executor import AgentExecutor

from ..tools.manager import ToolManager

if TYPE_CHECKING:
    from ..services.rag import RAGService

logger = logging.getLogger(__name__)


class MetaAgentSystem:
    """Dynamic meta-agent system."""

    def __init__(
        self,
        config: Config,
        tools: List[BaseTool],
        rag_service: Optional["RAGService"] = None,
        tool_manager: Optional[ToolManager] = None,
    ):
        """Initialize meta-agent system.

        Args:
            config: Application configuration.
            tools: Available tools.
            rag_service: Optional RAG service for active knowledge retrieval.
            tool_manager: Optional tool manager for role-specific MCP tools.
        """
        self.config = config
        self.tools = tools
        self.rag_service = rag_service
        self.tool_manager = tool_manager
        self.role_library = RoleLibrary()

        # Initialize LLM
        self.llm = create_llm(config)
        logger.info(f"✓ Initialized {config.llm_provider} LLM: {self.llm.__class__.__name__}")

        # Initialize coordinator with RAG support
        self.coordinator = MetaCoordinator(config, self.llm, rag_service=rag_service)

        # Initialize executor
        self.agent_executor = AgentExecutor(
            llm=self.llm,
            tools=tools,
            role_library=self.role_library,
            ui_display_limit=config.ui_display_limit,
            tool_manager=tool_manager,
        )

        # Conversation memory
        self.conversation_history: List[Dict[str, str]] = []
        
        # Per-session conversation histories
        self._session_histories: Dict[str, List[Dict[str, str]]] = {}
        self._current_session_id: Optional[str] = None

        # Visualization
        self.visualizer = ExecutionVisualizer()

        # Execution settings from config
        self.max_delegation_depth = config.max_delegation_depth
        self.absolute_max_depth = config.absolute_max_depth
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
        """Set the current session for conversation history.
        
        Args:
            session_id: Session ID to activate, or None to use default history.
        """
        self._current_session_id = session_id
        if session_id is None:
            # Use default conversation history
            self.conversation_history = []
        else:
            # Use or create session-specific history
            if session_id not in self._session_histories:
                self._session_histories[session_id] = []
            # Point conversation_history to the session's history
            self.conversation_history = self._session_histories[session_id]

    def load_session_history(self, session_id: str, messages: List[Dict[str, str]]) -> None:
        """Load conversation history for a session from database.
        
        Args:
            session_id: Session ID to load history for.
            messages: List of message dicts with 'role' and 'content'.
        """
        self._session_histories[session_id] = messages.copy()
        if self._current_session_id == session_id:
            self.conversation_history = self._session_histories[session_id]

    def get_session_history(self, session_id: Optional[str] = None) -> List[Dict[str, str]]:
        """Get conversation history for a session.
        
        Args:
            session_id: Session ID to get history for. Uses current if None.
        """
        sid = session_id or self._current_session_id
        if sid and sid in self._session_histories:
            return self._session_histories[sid]
        return self.conversation_history

    def clear_session_history(self, session_id: Optional[str] = None) -> None:
        """Clear conversation history for a session.
        
        Args:
            session_id: Session ID to clear. Uses current if None.
        """
        sid = session_id or self._current_session_id
        if sid and sid in self._session_histories:
            self._session_histories[sid] = []
            if self._current_session_id == sid:
                self.conversation_history = self._session_histories[sid]
        else:
            self.conversation_history = []

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
        if depth >= self.absolute_max_depth:
            logger.warning(f"🛑 Max depth {self.absolute_max_depth} reached")
            return {
                "final_answer": f"Maximum execution depth ({self.absolute_max_depth}) reached.",
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

        max_depth = min(max_depth, self.absolute_max_depth)

        indent = "  " * depth
        logger.info(f"{indent}🚀 Processing query (depth {depth}/{max_depth}): {query[:100]}...")

        context = self._build_context() if depth == 0 else ""
        plan = self.coordinator.create_execution_plan(
            query, context, depth=depth, max_depth=max_depth
        )

        if depth == 0:
            self.visualizer.display_plan_tree(
                plan.description, plan.agents, depth=depth, max_depth=max_depth
            )

        # Execute plan
        execution_layers = plan.get_execution_layers()
        self._log_execution_layers(execution_layers, plan.agents)

        trace = []
        outputs = {}

        for layer_idx, agent_indices in enumerate(execution_layers):
            logger.info(f"\n{'='*60}")
            logger.info(
                f"🔀 LAYER {layer_idx + 1}/{len(execution_layers)}: Executing {len(agent_indices)} agents"
            )
            logger.info(f"{'='*60}")

            if len(agent_indices) > 1:
                self.visualizer.display_parallel_agents_start(
                    [plan.agents[i] for i in agent_indices], layer_idx + 1, len(execution_layers)
                )

            if len(agent_indices) == 1:
                output = self._execute_single_agent(
                    agent_indices[0],
                    plan.agents[agent_indices[0]],
                    plan.agents,
                    outputs,
                    query,
                    depth,
                    max_depth,
                    trace,
                    layer_idx,
                    len(execution_layers),
                )
                outputs[agent_indices[0]] = output
            else:
                layer_outputs = asyncio.run(
                    self._execute_layer_parallel(
                        agent_indices,
                        plan.agents,
                        outputs,
                        query,
                        depth,
                        max_depth,
                        trace,
                        layer_idx,
                        len(execution_layers),
                    )
                )
                outputs.update(layer_outputs)

            if len(agent_indices) > 1:
                logger.info(f"✅ Layer {layer_idx + 1} complete")
                self.visualizer.console.print(
                    f"\n[bold green]✅ Layer {layer_idx + 1}/{len(execution_layers)} complete[/bold green]\n"
                )

        final_answer = outputs[len(plan.agents) - 1] if outputs else "No output generated"

        self.conversation_history.append({"role": "user", "content": query})
        self.conversation_history.append({"role": "assistant", "content": final_answer})

        result = {
            "final_answer": final_answer,
            "trace": trace,
            "plan": {
                "description": plan.description,
                "agents": [a["role"] for a in plan.agents],
                "execution_layers": len(execution_layers),
                "parallelization": f"{sum(len(layer) for layer in execution_layers)} total in {len(execution_layers)} layers",
            },
            "agents_spec": plan.agents,
            "execution_layers": execution_layers,
        }

        self.visualizer.display_summary(result)
        return result

    def _log_execution_layers(self, layers: List[List[int]], agents: List[Dict[str, Any]]) -> None:
        """Log execution layer details."""
        logger.info("")
        logger.info("🔀" + "=" * 70)
        logger.info(f"🔀 PARALLEL EXECUTION: {len(layers)} layers total")
        logger.info("🔀" + "=" * 70)
        for layer_idx, layer in enumerate(layers):
            layer_agents = [agents[i]["role"] for i in layer]
            if len(layer) > 1:
                logger.info(
                    f"🔀 Layer {layer_idx}: ⚡ {len(layer)} agents IN PARALLEL - {layer_agents}"
                )
            else:
                logger.info(f"🔀 Layer {layer_idx}: 1 agent (sequential) - {layer_agents}")
        logger.info("🔀" + "=" * 70)
        logger.info("")

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
        """Execute a single agent and update trace."""
        role_name = agent_spec.get("role")
        task = agent_spec.get("task")

        if not role_name or not task:
            logger.error(f"Invalid agent spec: {agent_spec}")
            return ""

        logger.info(f"🤖 Agent {agent_index}: {role_name.upper()}")
        logger.info(f"   Task: {task}")

        self.visualizer.display_execution_progress(
            current_step=agent_index + 1,
            total_steps=len(all_agents),
            role=role_name,
            task=task,
            status="running",
            layer=layer_idx + 1,
            total_layers=total_layers,
        )

        role = self.role_library.get_role(role_name)
        if not role:
            error_msg = f"Unknown role '{role_name}' - valid: {self.role_library.list_roles()}"
            logger.error(f"❌ {error_msg}")
            return f"[ERROR: {error_msg}]"

        depends_on = agent_spec.get("depends_on", [])
        previous_outputs = [completed_outputs[i] for i in depends_on if i in completed_outputs]

        result = self.agent_executor.execute(
            role=role,
            task=task,
            original_query=query,
            previous_outputs=previous_outputs,
            depth=depth,
            max_depth=max_depth,
            process_query_callback=self.process_query,
        )

        output = result.get("content", str(result)) if isinstance(result, dict) else str(result)

        trace.append(
            {
                "step": agent_index,
                "role": role_name,
                "task": task,
                "depends_on": depends_on,
                "parallel": False,
                "output": output[:200] + "..." if len(output) > 200 else output,
            }
        )

        return output

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
        """Execute multiple agents in parallel."""
        logger.info(
            f"⚡ Executing {len(agent_indices)} agents in parallel (max {self.max_parallel_agents} concurrent)..."
        )

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
                    layer_idx,
                    total_layers,
                )
            )
            tasks.append((i, task))

        results = {}
        for i, task in tasks:
            output = await task
            results[i] = output

            trace.append(
                {
                    "step": i,
                    "role": all_agents[i].get("role"),
                    "task": all_agents[i].get("task"),
                    "depends_on": all_agents[i].get("depends_on", []),
                    "parallel": True,
                    "output": output[:200] + "..." if len(output) > 200 else output,
                }
            )

        return results

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
        """Execute agent with semaphore to limit concurrency."""
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
                layer_idx,
                total_layers,
            )
            logger.info(f"🔒 Agent {agent_index} released semaphore slot")
            return result

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
        """Async wrapper for executing an agent."""
        role_name = agent_spec.get("role")
        task = agent_spec.get("task")

        if not role_name or not task:
            logger.error(f"Invalid agent spec: {agent_spec}")
            return ""

        logger.info(f"⚡ [PARALLEL Layer {layer_idx + 1}] Agent {agent_index}: {role_name.upper()}")

        role = self.role_library.get_role(role_name)
        if not role:
            logger.error(f"Unknown role: {role_name}")
            return ""

        depends_on = agent_spec.get("depends_on", [])
        previous_outputs = [completed_outputs[i] for i in depends_on if i in completed_outputs]

        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            self.agent_executor.execute,
            role,
            task,
            query,
            previous_outputs,
            depth,
            max_depth,
            self.process_query,
        )

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
        input_artifacts: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """Execute a single agent for LangGraph integration.
        
        Note: Individual agents do NOT receive conversation history.
        Only the Meta Coordinator has access to session history for planning.
        """
        role_obj = self.role_library.get_role(role)
        if not role_obj:
            logger.error(f"Unknown role: {role}")
            return {"content": f"[ERROR: Unknown role '{role}']", "tool_calls": [], "input_artifacts": input_artifacts or []}

        self.visualizer.display_execution_progress(
            current_step=agent_number,
            total_steps=total_agents,
            role=role,
            task=task,
            status="running",
            layer=layer + 1,
            total_layers=total_layers,
        )

        # Parse context to extract previous outputs
        previous_outputs = self._parse_context(context, agent_id)

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
                agent_id,
            )
        else:
            # Log why not streaming if it was the target agent
            if self._stream_callback and self._stream_agent_id == agent_id and role_obj.needs_tools:
                logger.info(f"⚠️ Agent {agent_id} needs tools, using non-streaming execution with full tool support")
            # Execute agent in thread pool with agent_id for token tracking
            # Note: Agents do NOT receive conversation history - only the coordinator has it
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None,
                self.agent_executor.execute,
                role_obj,
                task,
                original_query,
                previous_outputs,
                0,  # depth
                3,  # max_depth
                self.process_query,
                agent_id,  # Pass agent_id for token tracking
            )

        # Add input_artifacts to result for tracking in UI
        if isinstance(result, dict):
            result["input_artifacts"] = input_artifacts or []

        logger.info(f"✅ {agent_id} ({role}) completed")
        return result
    
    async def _execute_agent_streaming(
        self,
        role,
        task: str,
        original_query: str,
        previous_outputs: List[str],
        agent_id: str = "",
    ) -> Dict[str, Any]:
        """Execute an agent with streaming output.
        
        This is used for the final agent to stream response tokens in real-time.
        
        Args:
            role: Agent role definition.
            task: Specific task for this agent.
            original_query: Original user query.
            previous_outputs: Outputs from previous agents.
            agent_id: Agent identifier.
            
        Returns:
            Dict with 'content' (agent's text output) and 'tool_calls' (empty for streaming).
        """
        from langchain_core.messages import SystemMessage, HumanMessage
        from langchain_core.runnables import RunnableConfig
        
        # Build context
        context_parts = [f"Original question: {original_query}"]
        
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
                # Truncate long outputs
                output_display = (
                    output[:4000] + "... [truncated]"
                    if len(output) > 4000
                    else output
                )
                context_parts.append(f"\nAgent {i} output:\n{output_display}")
        else:
            context_parts.append("\n=== You are the first agent ===")
            context_parts.append("No prior agent outputs available yet.")
        
        context = "\n".join(context_parts)
        
        # Build messages
        output_limit_instruction = f"\n\nIMPORTANT: Keep your response concise and under 4000 characters. Be direct and focused."
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
        
        # Stream from LLM
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
            logger.info(f"✅ Streamed {len(full_content)} chars for {agent_id}")
            
            return {
                "content": full_content,
                "tool_calls": [],  # Tools not supported in streaming mode
                "artifacts": [],
            }
        except Exception as e:
            logger.error(f"Streaming error for {agent_id}: {e}")
            # Fallback to non-streaming
            response = self.llm.invoke(messages, config=config)
            return {
                "content": str(response.content),
                "tool_calls": [],
                "artifacts": [],
            }

    def _parse_context(self, context: str, agent_id: str) -> List[str]:
        """Parse context string to extract previous outputs."""
        previous_outputs = []
        if not context:
            logger.info(f"Agent {agent_id} has no context (first agent)")
            return previous_outputs

        logger.info(f"Agent {agent_id} received context: {context[:500]}...")

        parts = context.split("\n\n")
        for part in parts:
            part = part.strip()
            if not part:
                continue

            if part.startswith("From "):
                if ":\n" in part:
                    _, output = part.split(":\n", 1)
                    if output:
                        previous_outputs.append(output)
                elif ":" in part:
                    _, rest = part.split(":", 1)
                    rest = rest.strip()
                    if rest:
                        previous_outputs.append(rest)
            elif not part.startswith(("Original question:", "===")):
                previous_outputs.append(part)

        logger.info(f"Total previous outputs extracted: {len(previous_outputs)}")
        return previous_outputs

    def _build_context(self) -> str:
        """Build conversation context from history."""
        if not self.conversation_history:
            return ""

        recent = self.conversation_history[-4:]
        lines = []
        for msg in recent:
            role_label = "User" if msg["role"] == "user" else "Assistant"
            content = msg["content"][:150] + "..." if len(msg["content"]) > 150 else msg["content"]
            lines.append(f"{role_label}: {content}")

        return "\n".join(lines) if lines else ""

    def clear_memory(self) -> None:
        """Clear conversation history."""
        self.conversation_history.clear()
        logger.info("💾 Conversation memory cleared")

    def get_memory_summary(self) -> Dict[str, Any]:
        """Get conversation memory summary."""
        return {
            "message_count": len(self.conversation_history),
            "exchanges": len(self.conversation_history) // 2,
            "preview": self.conversation_history[-2:] if self.conversation_history else [],
        }

    def generate_execution_graph(self, result: Dict[str, Any], auto_open: bool = True) -> str:
        """Generate interactive HTML graph of last execution."""
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
