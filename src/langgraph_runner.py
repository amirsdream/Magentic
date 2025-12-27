"""
LangGraph-based execution engine for Magentic meta-agent system.

This module provides state management, checkpointing, and message passing
while preserving the dynamic meta-agent behavior.
"""

import asyncio
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional

from langgraph.graph import StateGraph, END, START
from langgraph.graph.state import CompiledStateGraph
from langgraph.checkpoint.memory import MemorySaver
from langchain_core.runnables import RunnableConfig
from rich.console import Console

from .execution import MagenticGraphBuilder, MagenticState
from .coordinator import ExecutionPlan
from .agents import MetaAgentSystem

console = Console()
logger = logging.getLogger(__name__)


class LangGraphExecutor:
    """Execute queries using LangGraph infrastructure."""

    def __init__(self, meta_system: MetaAgentSystem):
        """Initialize with meta-agent system.

        Args:
            meta_system: Initialized MetaAgentSystem
        """
        self.meta_system = meta_system
        self.graph_builder = MagenticGraphBuilder(meta_system)

    async def execute_query(
        self, 
        query: str, 
        stream: bool = False, 
        plan: Optional[ExecutionPlan] = None,
        cancel_event: Optional[asyncio.Event] = None
    ) -> Dict[str, Any]:
        """Execute a query using LangGraph.

        Args:
            query: User query to process
            stream: Whether to stream output
            plan: Optional pre-created execution plan. If not provided, creates a new one.
            cancel_event: Optional event to signal cancellation

        Returns:
            Execution result with output and metadata
        """
        # Helper to check if cancelled
        def is_cancelled():
            return cancel_event is not None and cancel_event.is_set()

        # Check cancellation before starting
        if is_cancelled():
            raise asyncio.CancelledError("Execution cancelled")

        # Use provided plan or create new one
        if plan is None:
            context = self.meta_system._build_context()
            plan = self.meta_system.coordinator.create_execution_plan(query, context)

        console.print(f"\n[bold cyan]📋 Plan: {plan.description}[/bold cyan]")
        console.print(f"[dim]Agents: {[a['role'] for a in plan.agents]}[/dim]\n")

        # Display plan tree
        self.meta_system.visualizer.display_plan_tree(plan.description, plan.agents)

        # Build dynamic graph
        console.print("[cyan]Building execution graph...[/cyan]")
        compiled_graph = self.graph_builder.build_dynamic_graph(plan)

        # Create initial state
        initial_state = self.graph_builder.create_initial_state(query)

        # Execute graph
        console.print("[cyan]Executing agents...[/cyan]\n")

        config: RunnableConfig = {"configurable": {"thread_id": initial_state["session_id"]}}

        if stream:
            result = await self._execute_streaming(compiled_graph, initial_state, config, plan)
        else:
            result = await self._execute_batch(compiled_graph, initial_state, config, plan)

        # Update conversation history
        if result.get("final_output"):
            self.meta_system.conversation_history.append({"role": "user", "content": query})
            self.meta_system.conversation_history.append(
                {"role": "assistant", "content": result["final_output"]}
            )

        return result

    async def _execute_batch(
        self,
        graph: CompiledStateGraph,
        initial_state: MagenticState,
        config: RunnableConfig,
        plan: ExecutionPlan,
    ) -> Dict[str, Any]:
        """Execute graph in batch mode."""
        final_state = await graph.ainvoke(initial_state, config)

        # Extract final output from last agent
        final_output = None
        agents = plan.agents
        if agents:
            last_agent_id = f"{agents[-1]['role']}_{len(agents)-1}"
            final_output = final_state.get("agent_outputs", {}).get(last_agent_id)

        return {
            "session_id": final_state.get("session_id", "unknown"),
            "final_output": final_output or "No output generated",
            "agent_outputs": final_state.get("agent_outputs", {}),
            "execution_trace": final_state.get("execution_trace", []),
            "agent_count": len(agents),
            "layer_count": len(plan.get_execution_layers()),
            "conversation_history": final_state.get("conversation_history", []),
        }

    async def _execute_streaming(
        self,
        graph: CompiledStateGraph,
        initial_state: MagenticState,
        config: RunnableConfig,
        plan: ExecutionPlan,
    ) -> Dict[str, Any]:
        """Execute graph with streaming output."""
        final_state = None

        async for event in graph.astream(initial_state, config):
            for node_name, state_update in event.items():
                if node_name.startswith("barrier_"):
                    continue
                console.print(f"[dim]Event from {node_name}[/dim]")
                final_state = state_update

        if final_state is None:
            return {
                "session_id": initial_state["session_id"],
                "final_output": "No output generated",
                "agent_outputs": {},
                "execution_trace": [],
                "agent_count": len(plan.agents),
                "layer_count": len(plan.get_execution_layers()),
                "conversation_history": [],
            }

        # Extract final output
        agents = plan.agents
        final_output = None
        if agents:
            last_agent_id = f"{agents[-1]['role']}_{len(agents)-1}"
            final_output = final_state.get("agent_outputs", {}).get(last_agent_id)

        return {
            "session_id": final_state.get("session_id", initial_state["session_id"]),
            "final_output": final_output or "No output generated",
            "agent_outputs": final_state.get("agent_outputs", {}),
            "execution_trace": final_state.get("execution_trace", []),
            "agent_count": len(agents),
            "layer_count": len(plan.get_execution_layers()),
            "conversation_history": final_state.get("conversation_history", []),
        }
