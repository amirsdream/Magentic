"""Role library - loads agent roles from YAML configuration.

Roles are defined in config/roles.yaml for easy customization.
Non-technical users can add new roles without touching Python code.
"""

import logging
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

import yaml

logger = logging.getLogger(__name__)

# Default config path
CONFIG_DIR = Path(__file__).parent.parent / "config"
ROLES_YAML = CONFIG_DIR / "roles.yaml"


@dataclass
class AgentRole:
    """Definition of an agent role."""

    name: str
    label: str
    description: str
    icon: str
    capabilities: List[str]
    system_prompt: str
    needs_tools: bool = False
    can_delegate: bool = False
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API response."""
        return {
            "name": self.name,
            "label": self.label,
            "description": self.description,
            "icon": self.icon,
            "capabilities": self.capabilities,
            "needs_tools": self.needs_tools,
            "can_delegate": self.can_delegate,
        }


class RoleLibrary:
    """Library of available agent roles loaded from YAML."""

    def __init__(self, config_path: Optional[Path] = None):
        """Initialize role library from YAML config."""
        self.config_path = config_path or ROLES_YAML
        self.roles: Dict[str, AgentRole] = {}
        self.mcp_servers: Dict[str, str] = {}
        self._load_from_yaml()
        logger.info(f"Loaded {len(self.roles)} roles from {self.config_path}")

    def _load_from_yaml(self) -> None:
        """Load roles from YAML configuration file."""
        try:
            if not self.config_path.exists():
                logger.warning(f"Roles config not found at {self.config_path}, using defaults")
                self._load_default_roles()
                return

            with open(self.config_path, "r") as f:
                raw_config = yaml.safe_load(f)
            
            # Ensure config is a dict
            if not isinstance(raw_config, dict):
                logger.warning("Invalid roles config format, using defaults")
                self._load_default_roles()
                return
            
            config: Dict[str, Any] = raw_config

            if not config or "roles" not in config:
                logger.warning("Invalid roles config, using defaults")
                self._load_default_roles()
                return

            # Load roles
            roles_config: Dict[str, Any] = config.get("roles", {})
            for name, role_config in roles_config.items():
                self.roles[name] = AgentRole(
                    name=name,
                    label=role_config.get("label", name.title()),
                    description=role_config.get("description", ""),
                    icon=role_config.get("icon", "bot"),
                    capabilities=role_config.get("capabilities", []),
                    system_prompt=role_config.get("system_prompt", ""),
                    needs_tools=role_config.get("needs_tools", False),
                    can_delegate=role_config.get("can_delegate", False),
                )

            # Load MCP server mappings
            self.mcp_servers = config.get("mcp_servers", {})

        except Exception as e:
            logger.error(f"Error loading roles from YAML: {e}")
            self._load_default_roles()

    def _load_default_roles(self) -> None:
        """Load minimal default roles when YAML is unavailable."""
        self.roles = {
            "researcher": AgentRole(
                name="researcher",
                label="Researcher",
                description="Conducts research and gathers information",
                icon="search",
                capabilities=["web_search", "fact_finding"],
                system_prompt="You are a research specialist.",
                needs_tools=True,
            ),
            "coder": AgentRole(
                name="coder",
                label="Coder",
                description="Writes and executes code",
                icon="code",
                capabilities=["coding", "code_execution"],
                system_prompt="You are a coding specialist.",
                needs_tools=True,
            ),
            "analyzer": AgentRole(
                name="analyzer",
                label="Analyzer",
                description="Analyzes data and information",
                icon="brain",
                capabilities=["analysis", "reasoning"],
                system_prompt="You are an analysis specialist.",
                needs_tools=True,
            ),
            "writer": AgentRole(
                name="writer",
                label="Writer",
                description="Writes content and documents",
                icon="file-text",
                capabilities=["writing", "documentation"],
                system_prompt="You are a writing specialist.",
                needs_tools=True,
            ),
            "synthesizer": AgentRole(
                name="synthesizer",
                label="Synthesizer",
                description="Combines inputs into final output",
                icon="zap",
                capabilities=["synthesis", "integration"],
                system_prompt="You are a synthesis specialist.",
                needs_tools=False,
            ),
        }
        self.mcp_servers = {
            "researcher": "websearch",
            "coder": "filesystem, python",
            "analyzer": "python",
            "writer": "filesystem",
        }

    def get_role(self, role_name: str) -> Optional[AgentRole]:
        """Get a role by name."""
        return self.roles.get(role_name)

    def list_roles(self) -> List[str]:
        """List all available role names."""
        return list(self.roles.keys())
    
    def get_all_roles_config(self) -> Dict[str, Dict[str, Any]]:
        """Get all roles configuration for frontend."""
        return {name: role.to_dict() for name, role in self.roles.items()}

    def describe_roles(self) -> str:
        """Get a description of all roles for the coordinator."""
        lines = ["Available Agent Roles:"]
        for name, role in self.roles.items():
            tools_info = ""
            if role.needs_tools:
                mcp_servers = self.mcp_servers.get(name, "")
                tools_info = f" [MCP TOOLS: {mcp_servers}]" if mcp_servers else " [HAS TOOLS]"
            delegate = " [CAN DELEGATE]" if role.can_delegate else ""
            lines.append(f"- {name}: {role.description}{tools_info}{delegate}")
        return "\n".join(lines)
    
    def reload(self) -> None:
        """Reload roles from YAML file."""
        self._load_from_yaml()
        logger.info(f"Reloaded {len(self.roles)} roles")
