"""Visualization tools for execution flow."""

import logging
from typing import List, Dict, Any, Optional
from pathlib import Path
from datetime import datetime

from rich.console import Console
from rich.tree import Tree
from rich.panel import Panel
from rich.table import Table
from rich import box

from pyvis.network import Network

logger = logging.getLogger(__name__)


class ExecutionVisualizer:
    """Visualize agent execution flow."""

    def __init__(self):
        """Initialize visualizer."""
        self.console = Console()
        self.execution_data: List[Dict[str, Any]] = []

    def display_plan_tree(
        self,
        plan_description: str,
        agents: List[Dict[str, Any]],
        depth: int = 0,
        max_depth: int = 3,
    ) -> None:
        """Display execution plan as a tree in terminal."""
        indent = "  " * depth
        depth_marker = f"[L{depth}] " if depth > 0 else ""
        complexity_marker = f" (max depth: {max_depth})" if depth == 0 else ""

        tree = Tree(
            f"[bold cyan]{indent}{depth_marker}📋 Execution Plan: {plan_description}{complexity_marker}[/bold cyan]",
            guide_style="bright_blue",
        )

        for i, agent in enumerate(agents):
            role = agent.get("role", "unknown")
            task = agent.get("task", "no task")
            can_delegate = agent.get("can_delegate", False)
            depends_on = agent.get("depends_on", [])

            delegate_marker = " 🔀" if can_delegate else ""
            parallel_marker = " ⚡" if not depends_on else ""
            agent_node = tree.add(
                f"[bold yellow]Agent {i}: {role.upper()}{delegate_marker}{parallel_marker}[/bold yellow]"
            )
            agent_node.add(f"[dim]Task: {task}[/dim]")

            if depends_on:
                deps_str = ", ".join(str(d) for d in depends_on)
                agent_node.add(f"[dim cyan]Depends on: agents {deps_str}[/dim cyan]")
            else:
                agent_node.add(f"[dim green]No dependencies (runs immediately)[/dim green]")

            if can_delegate:
                agent_node.add(f"[dim italic](Can delegate to sub-agents)[/dim italic]")

        self.console.print("\n")
        self.console.print(tree)
        self.console.print("\n")

    def display_execution_progress(
        self,
        current_step: int,
        total_steps: int,
        role: str,
        task: str,
        status: str = "running",
        layer: int = 1,
        total_layers: int = 1,
    ) -> None:
        """Display current execution progress."""
        status_emoji = {"running": "🔄", "complete": "✅", "error": "❌"}
        emoji = status_emoji.get(status, "▶️")
        border_style = "green" if status == "complete" else "cyan" if status == "running" else "red"

        table = Table(show_header=False, box=box.ROUNDED, border_style=border_style)
        table.add_column("Key", style="bold", width=10)
        table.add_column("Value")

        layer_info = f"{layer}/{total_layers}"
        if layer > 1 or total_layers > 1:
            layer_info += " ⚡"

        table.add_row("Layer", layer_info)
        table.add_row("Agent", f"#{current_step}/{total_steps}")
        table.add_row("Role", f"{emoji} {role.upper()}")
        task_display = task[:80] + "..." if len(task) > 80 else task
        table.add_row("Task", task_display)
        table.add_row("Status", status.upper())

        self.console.print(table)

    def display_parallel_agents_start(
        self, agents: List[Dict[str, Any]], layer: int, total_layers: int
    ) -> None:
        """Display all agents starting in a parallel layer."""
        if len(agents) <= 1:
            return

        self.console.print(
            f"\n[bold yellow]⚡ Layer {layer}/{total_layers}: {len(agents)} agents running in PARALLEL[/bold yellow]"
        )

        table = Table(show_header=True, box=box.SIMPLE, border_style="yellow")
        table.add_column("#", style="cyan", width=4)
        table.add_column("Role", style="bold magenta")
        table.add_column("Task", style="white")

        for idx, agent in enumerate(agents):
            role = agent.get("role", "unknown")
            task = agent.get("task", "")
            task_short = task[:60] + "..." if len(task) > 60 else task
            table.add_row(str(idx + 1), role.upper(), task_short)

        self.console.print(table)
        self.console.print()

    def create_execution_graph(
        self,
        plan_description: str,
        agents: List[Dict[str, Any]],
        trace: List[Dict[str, Any]],
        execution_layers: Optional[List[List[int]]] = None,
        output_path: Optional[str] = None,
    ) -> str:
        """Create interactive HTML graph of execution flow."""
        # Build set of parallel agents
        parallel_agents = set()
        if execution_layers:
            for layer in execution_layers:
                if len(layer) > 1:
                    parallel_agents.update(layer)

        net = Network(height="600px", width="100%", bgcolor="#1e1e1e", directed=True)
        self._configure_network_options(net)

        # Add start node
        net.add_node(
            "start",
            label="START",
            shape="box",
            color="#4CAF50",
            font={"size": 16, "color": "white"},
            title=plan_description,
        )

        # Add agent nodes and edges
        last_agents = self._add_agent_nodes(net, agents, trace, parallel_agents)

        # Add end node
        net.add_node(
            "end",
            label="END",
            shape="box",
            color="#4CAF50",
            font={"size": 16, "color": "white"},
            title="Execution complete",
        )

        for agent_id in last_agents:
            net.add_edge(agent_id, "end", color={"color": "#4CAF50", "opacity": 0.8}, width=2)

        # Generate output path
        if not output_path:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_dir = Path("execution_graphs")
            output_dir.mkdir(exist_ok=True)
            output_path = str(output_dir / f"execution_{timestamp}.html")

        net.save_graph(output_path)
        logger.info(f"💾 Execution graph saved to: {output_path}")
        return output_path

    def _configure_network_options(self, net: Network) -> None:
        """Configure pyvis network options."""
        net.set_options(
            """
        {
            "physics": {
                "enabled": true,
                "hierarchicalRepulsion": {
                    "centralGravity": 0.3,
                    "springLength": 150,
                    "nodeDistance": 200
                },
                "solver": "hierarchicalRepulsion"
            },
            "layout": {
                "hierarchical": {
                    "enabled": true,
                    "direction": "UD",
                    "sortMethod": "directed",
                    "levelSeparation": 150
                }
            }
        }
        """
        )

    def _add_agent_nodes(
        self,
        net: Network,
        agents: List[Dict[str, Any]],
        trace: List[Dict[str, Any]],
        parallel_agents: set,
    ) -> List[str]:
        """Add agent nodes and edges to network."""
        colors = {
            "researcher": "#2196F3",
            "analyzer": "#9C27B0",
            "planner": "#FF9800",
            "writer": "#E91E63",
            "coder": "#00BCD4",
            "critic": "#F44336",
            "synthesizer": "#4CAF50",
            "coordinator": "#FF5722",
        }

        all_dependencies = set()
        for agent in agents:
            all_dependencies.update(agent.get("depends_on", []))

        for i, agent in enumerate(agents):
            role = agent.get("role", "unknown")
            task = agent.get("task", "no task")
            depends_on = agent.get("depends_on", [])

            node_id = f"agent_{i}"
            color = colors.get(role.lower(), "#607D8B")
            is_parallel = i in parallel_agents

            # Get status from trace
            status, output = "pending", ""
            for t in trace:
                if t.get("step") == i:
                    status, output = "completed", t.get("output", "")[:200]
                    break

            parallel_marker = " ⚡ PARALLEL" if is_parallel else " 🔗 SEQUENTIAL"
            title = f"<b>Agent {i}: {role.upper()}{parallel_marker}</b><br>Task: {task}<br>Status: {status}"

            net.add_node(
                node_id,
                label=f"{i}. {role}",
                shape="circle",
                color=color,
                font={"size": 14, "color": "white"},
                title=title,
                size=35 if not depends_on else 30,
            )

            if not depends_on:
                net.add_edge(
                    "start",
                    node_id,
                    color={"color": "#4CAF50", "opacity": 0.8},
                    width=3,
                    title="Runs immediately",
                )
            else:
                for dep_idx in depends_on:
                    if 0 <= dep_idx < len(agents):
                        net.add_edge(
                            f"agent_{dep_idx}",
                            node_id,
                            color={"color": "#888", "opacity": 0.7},
                            width=2,
                            title=f"Waits for Agent {dep_idx}",
                        )

        return [f"agent_{i}" for i in range(len(agents)) if i not in all_dependencies]

    def show_memory_visualization(self, conversation_history: List[Dict[str, str]]) -> None:
        """Display conversation memory as a table."""
        if not conversation_history:
            self.console.print("[yellow]No conversation history[/yellow]")
            return

        table = Table(
            title="💾 Conversation Memory",
            show_header=True,
            header_style="bold cyan",
            box=box.ROUNDED,
        )
        table.add_column("#", style="dim", width=4)
        table.add_column("Role", width=12)
        table.add_column("Message", overflow="fold")

        for i, msg in enumerate(conversation_history, 1):
            role = msg["role"]
            content = msg["content"]
            role_display = "👤 User" if role == "user" else "🤖 Assistant"
            style = "cyan" if role == "user" else "green"
            display_content = content[:200] + "..." if len(content) > 200 else content
            table.add_row(str(i), f"[{style}]{role_display}[/{style}]", display_content)

        self.console.print("\n")
        self.console.print(table)
        self.console.print("\n")

    def display_summary(self, result: Dict[str, Any]) -> None:
        """Display execution summary in a panel."""
        summary_lines = [
            f"[bold]Plan:[/bold] {result['plan']['description']}",
            f"[bold]Agents:[/bold] {' → '.join(result['plan']['agents'])}",
            f"[bold]Steps:[/bold] {len(result['trace'])}",
        ]

        panel = Panel(
            "\n".join(summary_lines),
            title="[bold cyan]📊 Execution Summary[/bold cyan]",
            border_style="cyan",
            padding=(1, 2),
        )
        self.console.print("\n")
        self.console.print(panel)
