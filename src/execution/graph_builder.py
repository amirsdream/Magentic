"""LangGraph execution graph builder."""

import logging
from datetime import datetime
from typing import Dict, Any, List, TYPE_CHECKING

from langgraph.graph import StateGraph, END, START
from langgraph.graph.state import CompiledStateGraph
from langgraph.checkpoint.memory import MemorySaver
from rich.console import Console

from .state import MagenticState
from .nodes import create_agent_node, create_layer_barrier

if TYPE_CHECKING:
    from ..coordinator.plan import ExecutionPlan
    from ..agents.system import MetaAgentSystem

console = Console()
logger = logging.getLogger(__name__)


class MagenticGraphBuilder:
    """Builds LangGraph execution graphs dynamically from AI-generated plans.

    CRITICAL: This does NOT hardcode agent workflows. Each query gets a unique
    graph structure determined by the meta-coordinator's AI-driven planning.
    """

    def __init__(self, meta_system: "MetaAgentSystem"):
        """Initialize with reference to the meta-agent system.

        Args:
            meta_system: MetaAgentSystem instance with coordinator and tools
        """
        self.meta_system = meta_system
        self.checkpointer = MemorySaver()
        self.agent_to_layer: Dict[str, Any] = {}
        self.total_layers: int = 0
        self.total_agents: int = 0

    def build_dynamic_graph(self, execution_plan: "ExecutionPlan") -> CompiledStateGraph:
        """Build a LangGraph StateGraph from AI-generated execution plan.

        Args:
            execution_plan: Plan from meta_coordinator.create_execution_plan()

        Returns:
            Compiled StateGraph ready for execution
        """
        agents = execution_plan.agents
        layers = execution_plan.get_execution_layers()

        # Build mapping of agent_id to (layer_num, agent_idx)
        self.agent_to_layer = {}
        for layer_num, layer_agents in enumerate(layers):
            for agent_idx in layer_agents:
                agent_id = f"{agents[agent_idx]['role']}_{agent_idx}"
                self.agent_to_layer[agent_id] = {"layer": layer_num, "index": agent_idx}

        self.total_layers = len(layers)
        self.total_agents = len(agents)

        # Create new graph
        graph = StateGraph(MagenticState)

        # Add agent nodes
        for idx, agent_config in enumerate(agents):
            agent_id = f"{agent_config['role']}_{idx}"
            node_func = create_agent_node(agent_id, agent_config, agents, self.meta_system)
            graph.add_node(agent_id, node_func)

        # Add edges
        self._add_dynamic_edges(graph, agents, layers)

        return graph.compile(checkpointer=self.checkpointer)

    def _add_dynamic_edges(self, graph: StateGraph, agents: List[Dict], layers: List[List[int]]):
        """Add edges to graph based on AI-generated dependency structure."""

        def get_agent_id(idx: int) -> str:
            return f"{agents[idx]['role']}_{idx}"

        # Add barrier nodes for each layer (except the last)
        for layer_num in range(len(layers) - 1):
            barrier_name = f"barrier_layer_{layer_num}"
            barrier_func = create_layer_barrier(layer_num, layers[layer_num], agents)
            graph.add_node(barrier_name, barrier_func)
            console.print(f"  Added barrier: {barrier_name}")

        # Layer 0 agents connect from START
        if layers:
            for agent_idx in layers[0]:
                agent_id = get_agent_id(agent_idx)
                graph.add_edge(START, agent_id)
                console.print(f"  Edge: START → {agent_id}")

        # Connect layers through barriers
        for layer_num in range(len(layers)):
            current_layer_agents = layers[layer_num]

            if layer_num < len(layers) - 1:
                barrier_name = f"barrier_layer_{layer_num}"

                for agent_idx in current_layer_agents:
                    agent_id = get_agent_id(agent_idx)
                    graph.add_edge(agent_id, barrier_name)
                    console.print(f"  Edge: {agent_id} → {barrier_name}")

                next_layer_agents = layers[layer_num + 1]
                for agent_idx in next_layer_agents:
                    agent_id = get_agent_id(agent_idx)
                    graph.add_edge(barrier_name, agent_id)
                    console.print(f"  Edge: {barrier_name} → {agent_id}")

        # Last layer connects to END
        if layers:
            for agent_idx in layers[-1]:
                agent_id = get_agent_id(agent_idx)
                graph.add_edge(agent_id, END)
                console.print(f"  Edge: {agent_id} → END")

    def create_initial_state(self, query: str) -> MagenticState:
        """Create initial state for graph execution.

        Args:
            query: User query to process

        Returns:
            Initial MagenticState with query and empty collections
        """
        session_id = f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        return MagenticState(
            query=query,
            agent_outputs={},
            execution_trace=[],
            current_layer=0,
            total_layers=self.total_layers,
            agent_to_layer=self.agent_to_layer,
            messages=[],
            conversation_history=[],
            session_id=session_id,
            start_time=datetime.now().isoformat(),
            final_output=None,
        )
