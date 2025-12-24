"""Magentic - Magnetic Agent Networks Package."""

__version__ = "2.0.0"
__author__ = "Magentic Team"
__description__ = "Dynamic meta-agent system with LangGraph infrastructure"

# Core exports
from .config import Config
from .meta_agent_system import MetaAgentSystem
from .meta_coordinator import MetaCoordinator, ExecutionPlan
from .langgraph_executor import LangGraphExecutor, MagenticState
from .role_library import RoleLibrary
from .tools import ToolManager
from .observability import ObservabilityManager
from .visualization import ExecutionVisualizer

__all__ = [
    "Config",
    "MetaAgentSystem",
    "MetaCoordinator",
    "ExecutionPlan",
    "LangGraphExecutor",
    "MagenticState",
    "RoleLibrary",
    "ToolManager",
    "ObservabilityManager",
    "ExecutionVisualizer",
]

