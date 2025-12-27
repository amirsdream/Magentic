"""LangGraph state schema."""

from typing import TypedDict, Dict, Any, List, Optional, Annotated
import operator
from langchain_core.messages import BaseMessage


def merge_dicts(left: Dict[str, Any], right: Dict[str, Any]) -> Dict[str, Any]:
    """Merge two dictionaries for LangGraph state updates."""
    return {**left, **right}


def max_value(left: int, right: int) -> int:
    """Return maximum of two integers (for current_layer tracking)."""
    return max(left, right)


class MagenticState(TypedDict):
    """State shared across all agents in the execution graph.
    
    This preserves all data between agent executions and enables:
    - Agents to access outputs from dependencies
    - Checkpointing for crash recovery
    - Progress tracking and visualization
    - Message passing between agents
    """
    # Input
    query: str
    
    # Execution tracking
    agent_outputs: Annotated[Dict[str, Any], merge_dicts]  # Agent ID -> output
    execution_trace: Annotated[List[Dict[str, Any]], operator.add]  # Timeline of events
    current_layer: Annotated[int, max_value]  # Current layer (max from parallel agents)
    total_layers: int
    agent_to_layer: Dict[str, Any]  # Maps agent_id to {layer, index}
    
    # Agent communication
    messages: Annotated[List[BaseMessage], operator.add]  # For inter-agent messages
    conversation_history: Annotated[List[Dict[str, str]], operator.add]  # Chat history per step
    
    # Metadata
    session_id: str
    start_time: str
    
    # Final result
    final_output: Optional[str]


def visualize_state(state: Dict[str, Any], title: str = "State Snapshot") -> None:
    """Visualize the current state in a simple format."""
    print("\n" + "=" * 80)
    print(f"  {title}")
    print("=" * 80)
    
    if "agent_outputs" in state:
        print("\n📦 Agent Outputs:")
        print("-" * 80)
        for agent_id, output in state["agent_outputs"].items():
            output_str = str(output) if output else "(empty)"
            print(f"  • {agent_id:20s} | Length: {len(output_str):6d} | Preview: {output_str[:60]}...")
        print("-" * 80)
    
    print("\nℹ️  State Info:")
    print("-" * 80)
    print(f"  Query:               {state.get('query', 'N/A')[:80]}")
    print(f"  Current Layer:       {state.get('current_layer', 'N/A')}")
    print(f"  Total Layers:        {state.get('total_layers', 'N/A')}")
    print(f"  Conversation Steps:  {len(state.get('conversation_history', []))}")
    print(f"  Execution Traces:    {len(state.get('execution_trace', []))}")
    print("-" * 80)
    print("")
