"""LangGraph node creation."""

import os
import logging
import httpx
from datetime import datetime
from typing import Dict, Any, List, TYPE_CHECKING

from rich.console import Console

from .state import MagenticState, visualize_state
from ..config import Config
from ..artifact_service import ArtifactService

if TYPE_CHECKING:
    from ..agents.system import MetaAgentSystem

console = Console()
logger = logging.getLogger(__name__)
config = Config()

# MCP Gateway URL for fetching file content
MCP_GATEWAY_URL = os.getenv("MCP_GATEWAY_URL", "http://localhost:9000")


async def save_artifact_to_db(session_id: str, agent_id: str, artifact: Dict[str, Any]) -> bool:
    """Fetch artifact content from MCP filesystem and save to database.
    
    Args:
        session_id: Execution session ID
        agent_id: Agent that created the artifact
        artifact: Artifact metadata dict
        
    Returns:
        True if saved successfully, False otherwise
    """
    path = artifact.get("path", "")
    if not path:
        return False
    
    try:
        # Fetch content from MCP filesystem
        file_path = path
        if file_path.startswith("/workspace/"):
            file_path = file_path[len("/workspace/"):]
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"{MCP_GATEWAY_URL}/execute",
                json={
                    "server": "filesystem",
                    "tool": "read_file",
                    "params": {"path": file_path}
                }
            )
            
            if response.status_code == 200:
                result = response.json()
                content = result.get("result", {}).get("content", "")
                
                # Save to database
                ArtifactService.save_artifact(
                    session_id=session_id,
                    agent_id=agent_id,
                    name=artifact.get("name", path.split("/")[-1]),
                    path=path,
                    content=content,
                    language=artifact.get("language"),
                )
                logger.info(f"Saved artifact {path} to database for session {session_id}")
                return True
            else:
                logger.warning(f"Could not fetch artifact content for {path}: {response.status_code}")
                return False
                
    except Exception as e:
        logger.error(f"Error saving artifact {path} to database: {e}")
        return False


def create_agent_node(
    agent_id: str,
    agent_config: Dict[str, Any],
    all_agents: List[Dict],
    meta_system: "MetaAgentSystem",
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

        agent_info = state.get("agent_to_layer", {}).get(agent_id, {"layer": 0, "index": 0})
        agent_layer = agent_info["layer"]
        agent_idx = agent_info["index"]
        total_layers = state.get("total_layers", 1)
        total_agents = len(all_agents)

        # Gather context from dependencies
        context_parts = []
        if depends_on:
            console.print(
                f"  [cyan]Agent {agent_id} depends on {len(depends_on)} previous agents: {depends_on}[/cyan]"
            )

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
                console.print(
                    f"  [red]WARNING: {dep_agent_id} not found in state.agent_outputs![/red]"
                )
                console.print(
                    f"  [dim]Available outputs: {list(state['agent_outputs'].keys())}[/dim]"
                )

        # Add available artifacts to context if any exist
        available_artifacts = state.get("available_artifacts", {})
        if available_artifacts:
            artifact_list = []
            for path, artifact in available_artifacts.items():
                artifact_list.append(f"  - {artifact.get('name', path)} ({artifact.get('language', 'file')}) at: {path}")
            artifacts_context = "\n\n=== FILES CREATED BY PREVIOUS AGENTS ===\n"
            artifacts_context += "The following files were created and are available for you to use:\n"
            artifacts_context += "\n".join(artifact_list)
            artifacts_context += "\n\nIMPORTANT: If your task requires using these files, you MUST read them using the filesystem tool:"
            artifacts_context += "\n  - Use `mcp_filesystem_read_file` with the path above to read file contents"
            artifacts_context += "\n  - Review the file contents before using or referencing them in your work"
            artifacts_context += "\n======================================="
            context_parts.append(artifacts_context)
            console.print(f"  [yellow]✓ {len(available_artifacts)} artifact(s) available to this agent[/yellow]")

        # Add available references (citations) from previous agents
        available_references = state.get("available_references", [])
        if available_references:
            refs_context = "\n\n=== REFERENCES FROM PREVIOUS AGENTS ===\n"
            refs_context += "The following references were cited by previous agents:\n"
            for i, ref in enumerate(available_references, 1):
                title = ref.get("title", "Untitled")
                url = ref.get("url", "")
                source_agent = ref.get("source_agent", "unknown")
                refs_context += f"\n{i}. [{title}]({url})"
                refs_context += f"\n   Source: {source_agent}"
                if ref.get("snippet"):
                    refs_context += f"\n   Snippet: {ref.get('snippet')[:200]}..."
            refs_context += "\n\nYou may cite these references in your response if relevant."
            refs_context += "\n======================================="
            context_parts.append(refs_context)
            console.print(f"  [blue]✓ {len(available_references)} reference(s) available to this agent[/blue]")

        context = "\n\n".join(context_parts)
        if len(context_parts) > 1:
            console.print(
                f"  [green]Combined {len(context_parts)} agent outputs → {len(context)} chars total[/green]"
            )

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
                conversation_history=conversation_history,
            )

            output_content = (
                result.get("content", str(result)) if isinstance(result, dict) else str(result)
            )

            if not output_content or output_content.strip() == "":
                console.print(f"[red]WARNING: Agent {agent_id} produced EMPTY output![/red]")
                output_content = f"[ERROR: Agent {agent_id} produced no output]"

            console.print(f"[green]✓ {agent_id} completed ({len(output_content)} chars)[/green]")

            # Extract references from the result
            agent_references = result.get("references", []) if isinstance(result, dict) else []
            if agent_references:
                console.print(f"[cyan]   └─ Found {len(agent_references)} reference(s)[/cyan]")

            # Extract artifacts (created files) from the result
            agent_artifacts = result.get("artifacts", []) if isinstance(result, dict) else []
            if agent_artifacts:
                console.print(f"[yellow]   └─ Found {len(agent_artifacts)} artifact(s)[/yellow]")
                
                # Save artifacts to database for persistence
                session_id = state.get("session_id", "")
                if session_id:
                    for artifact in agent_artifacts:
                        await save_artifact_to_db(session_id, agent_id, artifact)

            conversation_entry = {
                "agent_id": agent_id,
                "role": role,
                "task": task,
                "input_context": (
                    context[: config.agent_context_limit] + "... [truncated]"
                    if context and len(context) > config.agent_context_limit
                    else (context or "(no previous context)")
                ),
                "output": (
                    output_content[: config.agent_context_limit] + "... [truncated]"
                    if len(output_content) > config.agent_context_limit
                    else output_content
                ),
                "layer": agent_layer,
                "timestamp": datetime.now().isoformat(),
                "references": agent_references,
                "artifacts": agent_artifacts,
            }

            # Build artifacts dict update (path -> artifact)
            artifacts_update = {}
            for artifact in agent_artifacts:
                path = artifact.get("path") or artifact.get("name", "")
                if path:
                    artifacts_update[path] = artifact

            # Build references list update (add source agent to each reference)
            references_update = []
            for ref in agent_references:
                ref_with_source = {**ref, "source_agent": agent_id}
                references_update.append(ref_with_source)

            state_update = {
                "agent_outputs": {agent_id: output_content},
                "current_layer": agent_layer,
                "conversation_history": [conversation_entry],
                "available_artifacts": artifacts_update,
                "available_references": references_update,
                "execution_trace": [
                    {
                        "agent_id": agent_id,
                        "role": role,
                        "layer": agent_layer,
                        "timestamp": datetime.now().isoformat(),
                        "status": "completed",
                        "output_length": len(output_content),
                        "references": agent_references,
                        "artifacts": agent_artifacts,
                    }
                ],
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
                "execution_trace": [
                    {
                        "agent_id": agent_id,
                        "role": role,
                        "timestamp": datetime.now().isoformat(),
                        "status": "failed",
                        "error": str(e),
                    }
                ],
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
                console.print(
                    f"  [yellow]Layer {layer_num} barrier: waiting for {agent_id}[/yellow]"
                )
                break

        if all_complete:
            console.print(
                f"  [green]✓ Layer {layer_num} complete - all {len(layer_agents)} agents finished[/green]"
            )

        return state

    return layer_barrier
