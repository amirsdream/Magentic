"""Role library - defines available agent roles without hardcoding agents."""

import logging
from dataclasses import dataclass
from typing import List, Optional

logger = logging.getLogger(__name__)


@dataclass
class AgentRole:
    """Definition of an agent role."""

    name: str
    description: str
    capabilities: List[str]
    system_prompt: str
    needs_tools: bool = False
    can_delegate: bool = False  # Can this role create sub-agents?


class RoleLibrary:
    """Library of available agent roles."""

    def __init__(self):
        """Initialize role library."""
        self.roles = self._load_roles()
        logger.info(f"Loaded {len(self.roles)} roles")

    def _load_roles(self) -> dict:
        """Load available roles."""
        return {
            "researcher": AgentRole(
                name="researcher",
                description="Conducts research and gathers information from the web",
                capabilities=["web_search", "fact_finding", "information_gathering"],
                system_prompt="You are a research specialist. Use web search to find accurate, current information. Cite your sources.",
                needs_tools=True,
            ),
            "analyzer": AgentRole(
                name="analyzer",
                description="Analyzes data, compares options, executes code for analysis",
                capabilities=["analysis", "comparison", "reasoning", "code_execution"],
                system_prompt="You are an analysis specialist. Break down complex information, identify patterns, and provide clear insights. Use Python execution when calculations are needed.",
                needs_tools=True,
            ),
            "planner": AgentRole(
                name="planner",
                description="Creates plans, strategies, and step-by-step solutions",
                capabilities=["planning", "strategy", "organization", "web_search"],
                system_prompt="You are a planning specialist. Create detailed, actionable plans with clear steps and considerations. Use web search to gather relevant information for planning.",
                needs_tools=True,
                can_delegate=True,
            ),
            "writer": AgentRole(
                name="writer",
                description="Writes content, summaries, documentation, and articles. Can save files.",
                capabilities=["writing", "summarization", "documentation", "file_operations"],
                system_prompt="""You are a writing specialist. Create clear, well-structured content tailored to the audience.

When asked to create a document or file:
1. Write the content
2. Save it using the filesystem tool (mcp_filesystem_write_file)
3. Report what file you created

If just asked for content without saving, return it directly.""",
                needs_tools=True,
            ),
            "coder": AgentRole(
                name="coder",
                description="Writes, executes, and debugs code using Python and filesystem tools",
                capabilities=["coding", "debugging", "code_review", "code_execution", "file_operations"],
                system_prompt="""You are a coding specialist. Write clean, well-documented code. 

IMPORTANT: When asked to write and run code, you MUST:
1. First write the code using the filesystem tool (mcp_filesystem_write_file)
2. Then EXECUTE the code using the python tool (mcp_python_execute_code) to show the output
3. Report the execution results

Always execute code to verify it works and show the output to the user.""",
                needs_tools=True,
            ),
            "critic": AgentRole(
                name="critic",
                description="Reviews work, finds issues, suggests improvements",
                capabilities=["review", "quality_check", "validation"],
                system_prompt="You are a quality reviewer. Identify issues, gaps, and areas for improvement. Be constructive.",
                needs_tools=False,
            ),
            "synthesizer": AgentRole(
                name="synthesizer",
                description="Combines multiple inputs into coherent final output",
                capabilities=["synthesis", "integration", "finalization"],
                system_prompt="You are a synthesis specialist. Combine all inputs into a comprehensive, well-structured final answer.",
                needs_tools=False,
            ),
            "retriever": AgentRole(
                name="retriever",
                description="Retrieves relevant information from knowledge base and databases",
                capabilities=["retrieval", "knowledge_search", "document_lookup", "database_query"],
                system_prompt="You are a knowledge retrieval specialist. Search the knowledge base and databases for relevant information and provide context.",
                needs_tools=True,
            ),
            "coordinator": AgentRole(
                name="coordinator",
                description="Manages complex multi-step workflows by delegating to specialized agents",
                capabilities=["task_decomposition", "delegation", "workflow_management", "web_search"],
                system_prompt="You are a workflow coordinator. For complex tasks, break them into sub-tasks and delegate to specialized agents. Use web search when you need information.",
                needs_tools=True,
                can_delegate=True,
            ),
            "data_engineer": AgentRole(
                name="data_engineer",
                description="Works with databases, data pipelines, and file operations",
                capabilities=["database_query", "data_transformation", "file_operations", "code_execution"],
                system_prompt="You are a data engineering specialist. Work with databases, transform data, and manage data pipelines. Use SQL and Python for data operations.",
                needs_tools=True,
            ),
            "debugger": AgentRole(
                name="debugger",
                description="Debugs code issues, traces errors, and validates fixes",
                capabilities=["debugging", "error_analysis", "code_execution", "file_operations"],
                system_prompt="You are a debugging specialist. Analyze code errors, trace issues, and validate fixes. Execute code to reproduce and verify bug fixes.",
                needs_tools=True,
            ),
            "tester": AgentRole(
                name="tester",
                description="Tests code, writes test cases, validates functionality",
                capabilities=["testing", "validation", "code_execution", "file_operations"],
                system_prompt="You are a testing specialist. Write and execute test cases, validate code functionality, and report test results.",
                needs_tools=True,
            ),
        }

    def get_role(self, role_name: str) -> Optional[AgentRole]:
        """Get a role by name."""
        return self.roles.get(role_name)

    def list_roles(self) -> List[str]:
        """List all available role names."""
        return list(self.roles.keys())

    def describe_roles(self) -> str:
        """Get a description of all roles for the coordinator."""
        # MCP server mapping for role descriptions
        role_mcp_servers = {
            "researcher": "websearch, github, memory",
            "coder": "filesystem, github, python, database",
            "analyzer": "websearch, python, database, memory",
            "writer": "filesystem",  # Writer can save files as artifacts
            "retriever": "filesystem, database, memory",
            "planner": "websearch, memory",
            "coordinator": "websearch, filesystem, github, memory",
            "data_engineer": "database, filesystem, python",
            "debugger": "python, filesystem, github",
            "tester": "python, filesystem",
        }
        
        lines = ["Available Agent Roles:"]
        for name, role in self.roles.items():
            tools_info = ""
            if role.needs_tools:
                mcp_servers = role_mcp_servers.get(name, "")
                tools_info = f" [MCP TOOLS: {mcp_servers}]" if mcp_servers else " [HAS TOOLS]"
            delegate = " [CAN DELEGATE]" if role.can_delegate else ""
            lines.append(f"- {name}: {role.description}{tools_info}{delegate}")
        return "\n".join(lines)
