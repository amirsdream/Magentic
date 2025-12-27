"""LangGraph node creation."""

import os
import logging
from datetime import datetime
from typing import Dict, Any, List, TYPE_CHECKING

from rich.console import Console

from .state import MagenticState, visualize_state

if TYPE_CHECKING:
    from ..agents.system import MetaAgentSystem

console = Console()
logger = logging.getLogger(__name__)


def create_agent_node(
    agent_id: str, 
    agent_config: Dict[str, Any], 
    all_agents: List[Dict],
    meta_system: "MetaAgentSystem"
):
    """Create a node function for a specific agent.
    
    Args:
        agent_id: Unique identifier for this agent (e.g., "researcher_0")
        agent_config: Agent configuration from ExecutionPlan
        all_agents: Full list of agents to resolve dependencies
        meta_system: Reference to meta agent system
        
    Returns:
        Async node function for LangGraph
    """
    role = agent_config["role"]
    task = agent_config["task"]
    depends_on = agent_config.get("depends_on", [])
    
    async def agent_node(state: MagenticState) -> Dict[str, Any]:
        """Execute this agent and update state."""
        console.print(f"\n[yellow]→ Executing {agent_id} ({role})...[/yellow]")
        
        if os.getenv("DEBUG_STATE", "").lower() == "true":
            visualize_state(dict(state), f"State BEFORE {agent_id}")
        
        agent_info = state.get("agent_to_layer", {}).get(agent_id, {'layer': 0, 'index': 0})
        agent_layer = agent_info['layer']
        agent_idx = agent_info['index']
        total_layers = state.get("total_layers", 1)
        total_agents = len(all_agents)
        
        # Gather context from dependencies
        context_parts = []
        if depends_on:
            console.print(f"  [cyan]Agent {agent_id} depends on {len(depends_on)} previous agents: {depends_on}[/cyan]")
        
        for dep_idx in depends_on:
            dep_agent_id = f"{all_agents[dep_idx]['role']}_{dep_idx}"
            if dep_agent_id in state["agent_outputs"]:
                dep_output = state["agent_outputs"][dep_agent_id]
                
                if dep_output is None or (isinstance(dep_output, str) and dep_output.strip() == ""):
                    console.print(f"  [red]WARNING: {dep_agent_id} output is empty![/red]")
                    output_str = "(no output from previous agent)"
                else:
                    output_str = str(dep_output).strip()
                    console.print(f"  [cyan]✓ Using {dep_agent_id}: {len(output_str)} chars[/cyan]")
                
                context_parts.append(f"From {dep_agent_id}:\n{output_str}")
            else:
                console.print(f"  [red]WARNING: {dep_agent_id} not found in state.agent_outputs![/red]")
                console.print(f"  [dim]Available outputs: {list(state['agent_outputs'].keys())}[/dim]")
        
        context = "\n\n".join(context_parts)
        if len(context_parts) > 1:
            console.print(f"  [green]Combined {len(context_parts)} agent outputs → {len(context)} chars total[/green]")
        
        try:
            console.print(f"  [dim]Task: {task[:80]}...[/dim]")
            
            conversation_history = state.get("conversation_history", [])
            
            result = await meta_system.execute_agent_for_langgraph(
                agent_id=agent_id,
                role=role,
                task=task,
                context=context,
                original_query=state["query"],
                layer=agent_layer,
                total_layers=total_layers,
                agent_number=agent_idx + 1,
                total_agents=total_agents,
                conversation_history=conversation_history
            )
            
            output_content = result.get("content", str(result)) if isinstance(result, dict) else str(result)
            
            if not output_content or output_content.strip() == "":
                console.print(f"[red]WARNING: Agent {agent_id} produced EMPTY output![/red]")
                output_content = f"[ERROR: Agent {agent_id} produced no output]"
            
            console.print(f"[green]✓ {agent_id} completed ({len(output_content)} chars)[/green]")
            
            conversation_entry = {
                "agent_id": agent_id,
                "role": role,
                "task": task,
                "input_context": context[:2000] + "... [truncated]" if context and len(context) > 2000 else (context or "(no previous context)"),
                "output": output_content[:2000] + "... [truncated]" if len(output_content) > 2000 else output_content,
                "layer": agent_layer,
                "timestamp": datetime.now().isoformat()
            }
            
            state_update = {
                "agent_outputs": {agent_id: output_content},
                "current_layer": agent_layer,
                "conversation_history": [conversation_entry],
                "execution_trace": [{
                    "agent_id": agent_id,
                    "role": role,
                    "layer": agent_layer,
                    "timestamp": datetime.now().isoformat(),
                    "status": "completed",
                    "output_length": len(output_content)
                }]
            }
            
            if os.getenv("DEBUG_STATE", "").lower() == "true":
                temp_state = {**state, **state_update}
                visualize_state(temp_state, f"State AFTER {agent_id}")
            
            return state_update
        
        except Exception as e:
            logger.error(f"Error in {agent_id}: {e}", exc_info=True)
            console.print(f"[red]Error in {agent_id}: {e}[/red]")
            return {
                "agent_outputs": {agent_id: f"Error: {str(e)}"},
                "execution_trace": [{
                    "agent_id": agent_id,
                    "role": role,
                    "timestamp": datetime.now().isoformat(),
                    "status": "failed",
                    "error": str(e)
                }]
            }
    
    return agent_node


def create_layer_barrier(layer_num: int, layer_agents: List[int], agents: List[Dict]):
    """Create a barrier node that waits for ALL agents in a layer to complete.
    
    Args:
        layer_num: Layer number
        layer_agents: Agent indices in this layer
        agents: All agent specs
        
    Returns:
        Barrier function for LangGraph
    """
    def layer_barrier(state: MagenticState) -> MagenticState:
        """Wait for all agents in this layer to complete."""
        all_complete = True
        for agent_idx in layer_agents:
            agent_id = f"{agents[agent_idx]['role']}_{agent_idx}"
            if agent_id not in state["agent_outputs"]:
                all_complete = False
                console.print(f"  [yellow]Layer {layer_num} barrier: waiting for {agent_id}[/yellow]")
                break
        
        if all_complete:
            console.print(f"  [green]✓ Layer {layer_num} complete - all {len(layer_agents)} agents finished[/green]")
        
        return state
    
    return layer_barrier
