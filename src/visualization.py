"""Visualization tools for execution flow."""

import logging
from typing import List, Dict, Any, Optional
from pathlib import Path
from datetime import datetime

from rich.console import Console
from rich.tree import Tree
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TimeElapsedColumn
from rich.live import Live
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
    
    def display_plan_tree(self, plan_description: str, agents: List[Dict[str, Any]], depth: int = 0, max_depth: int = 3) -> None:
        """Display execution plan as a tree in terminal.
        
        Args:
            plan_description: Plan description.
            agents: List of agent specifications.
            depth: Nesting depth (for hierarchical plans).
            max_depth: Maximum depth allowed for this plan.
        """
        indent = "  " * depth
        depth_marker = f"[L{depth}] " if depth > 0 else ""
        complexity_marker = f" (max depth: {max_depth})" if depth == 0 else ""
        
        tree = Tree(
            f"[bold cyan]{indent}{depth_marker}📋 Execution Plan: {plan_description}{complexity_marker}[/bold cyan]",
            guide_style="bright_blue"
        )
        
        for i, agent in enumerate(agents, 1):
            role = agent.get("role", "unknown")
            task = agent.get("task", "no task")
            can_delegate = agent.get("can_delegate", False)
            
            # Add agent node
            delegate_marker = " 🔀" if can_delegate else ""
            agent_node = tree.add(
                f"[bold yellow]Step {i}: {role.upper()}{delegate_marker}[/bold yellow]"
            )
            agent_node.add(f"[dim]Task: {task}[/dim]")
            if can_delegate:
                agent_node.add(f"[dim italic](Can delegate to sub-agents)[/dim italic]")
        
        self.console.print("\n")
        self.console.print(tree)
        self.console.print("\n")
    
    def display_execution_progress(self, 
                                   current_step: int,
                                   total_steps: int,
                                   role: str,
                                   task: str,
                                   status: str = "running") -> None:
        """Display current execution progress.
        
        Args:
            current_step: Current step number.
            total_steps: Total number of steps.
            role: Agent role.
            task: Current task.
            status: Status (running/complete/error).
        """
        status_emoji = {
            "running": "🔄",
            "complete": "✅",
            "error": "❌"
        }
        
        emoji = status_emoji.get(status, "▶️")
        
        table = Table(show_header=False, box=box.ROUNDED, border_style="cyan")
        table.add_column("Key", style="bold")
        table.add_column("Value")
        
        table.add_row("Progress", f"{current_step}/{total_steps}")
        table.add_row("Agent", f"{emoji} {role.upper()}")
        table.add_row("Task", task[:80] + "..." if len(task) > 80 else task)
        
        self.console.print(table)
    
    def create_execution_graph(self, 
                              plan_description: str,
                              agents: List[Dict[str, Any]],
                              trace: List[Dict[str, Any]],
                              output_path: Optional[str] = None) -> str:
        """Create interactive HTML graph of execution flow.
        
        Args:
            plan_description: Plan description.
            agents: List of agent specifications.
            trace: Execution trace.
            output_path: Output HTML file path. If None, auto-generates.
            
        Returns:
            Path to generated HTML file.
        """
        # Create network
        net = Network(
            height="600px",
            width="100%",
            bgcolor="#1e1e1e",
            directed=True
        )
        
        # Configure physics for better layout
        net.set_options("""
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
        """)
        
        # Add start node
        net.add_node(
            "start",
            label="START",
            shape="box",
            color="#4CAF50",
            font={"size": 16, "color": "white"},
            title=plan_description
        )
        
        # Add agent nodes
        prev_id = "start"
        colors = {
            "researcher": "#2196F3",
            "analyzer": "#9C27B0",
            "planner": "#FF9800",
            "writer": "#E91E63",
            "coder": "#00BCD4",
            "critic": "#F44336",
            "synthesizer": "#4CAF50"
        }
        
        for i, agent in enumerate(agents, 1):
            role = agent.get("role", "unknown")
            task = agent.get("task", "no task")
            
            node_id = f"agent_{i}"
            color = colors.get(role, "#607D8B")
            
            # Get execution status from trace
            status = "pending"
            output = ""
            if i <= len(trace):
                status = "completed"
                output = trace[i-1].get("output", "")[:200]
            
            # Create title with details
            title = f"""
            <b>Step {i}: {role.upper()}</b><br>
            Task: {task}<br>
            Status: {status}<br>
            {f'Output: {output}...' if output else ''}
            """
            
            # Add node
            net.add_node(
                node_id,
                label=f"{i}. {role}",
                shape="circle",
                color=color,
                font={"size": 14, "color": "white"},
                title=title.strip(),
                size=30
            )
            
            # Add edge from previous
            net.add_edge(
                prev_id,
                node_id,
                color={"color": "#888", "opacity": 0.8},
                width=2
            )
            
            prev_id = node_id
        
        # Add end node
        net.add_node(
            "end",
            label="END",
            shape="box",
            color="#4CAF50",
            font={"size": 16, "color": "white"},
            title="Execution complete"
        )
        net.add_edge(
            prev_id,
            "end",
            color={"color": "#888", "opacity": 0.8},
            width=2
        )
        
        # Generate output path if not provided
        if not output_path:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_dir = Path("execution_graphs")
            output_dir.mkdir(exist_ok=True)
            output_path = str(output_dir / f"execution_{timestamp}.html")
        
        # Save and return
        net.save_graph(output_path)
        logger.info(f"💾 Execution graph saved to: {output_path}")
        
        return output_path
    
    def show_memory_visualization(self, conversation_history: List[Dict[str, str]]) -> None:
        """Display conversation memory as a table.
        
        Args:
            conversation_history: List of conversation messages.
        """
        if not conversation_history:
            self.console.print("[yellow]No conversation history[/yellow]")
            return
        
        table = Table(
            title="💾 Conversation Memory",
            show_header=True,
            header_style="bold cyan",
            box=box.ROUNDED
        )
        
        table.add_column("#", style="dim", width=4)
        table.add_column("Role", width=12)
        table.add_column("Message", overflow="fold")
        
        for i, msg in enumerate(conversation_history, 1):
            role = msg["role"]
            content = msg["content"]
            
            role_display = "👤 User" if role == "user" else "🤖 Assistant"
            style = "cyan" if role == "user" else "green"
            
            # Truncate long messages
            display_content = content[:200] + "..." if len(content) > 200 else content
            
            table.add_row(
                str(i),
                f"[{style}]{role_display}[/{style}]",
                display_content
            )
        
        self.console.print("\n")
        self.console.print(table)
        self.console.print("\n")
    
    def display_summary(self, result: Dict[str, Any]) -> None:
        """Display execution summary in a panel.
        
        Args:
            result: Execution result dictionary.
        """
        summary_lines = []
        summary_lines.append(f"[bold]Plan:[/bold] {result['plan']['description']}")
        summary_lines.append(f"[bold]Agents:[/bold] {' → '.join(result['plan']['agents'])}")
        summary_lines.append(f"[bold]Steps:[/bold] {len(result['trace'])}")
        
        summary = "\n".join(summary_lines)
        
        panel = Panel(
            summary,
            title="[bold cyan]📊 Execution Summary[/bold cyan]",
            border_style="cyan",
            padding=(1, 2)
        )
        
        self.console.print("\n")
        self.console.print(panel)
