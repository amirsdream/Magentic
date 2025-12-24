"""Meta-coordinator that dynamically decides which agents to create and how to sequence them."""

import logging
import json
from typing import List, Dict, Any
from dataclasses import dataclass

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.runnables import RunnableConfig
from langchain_ollama import ChatOllama

from .config import Config
from .role_library import RoleLibrary

logger = logging.getLogger(__name__)


@dataclass
class ExecutionPlan:
    """Plan for executing a task with dynamic agents."""
    description: str
    agents: List[Dict[str, Any]]  # List of {role, task, can_delegate}
    depth: int = 0  # Nesting level (0 = root)
    
    
class MetaCoordinator:
    """Meta-coordinator that plans and manages dynamic agent execution."""
    
    def __init__(self, config: Config):
        """Initialize meta-coordinator.
        
        Args:
            config: Application configuration.
        """
        self.config = config
        self.llm = ChatOllama(
            model=config.ollama_model,
            temperature=0.7,  # Higher for more creative agent planning
        )
        self.role_library = RoleLibrary()
    
    def create_execution_plan(self, query: str, conversation_history: str = "", depth: int = 0, max_depth: int = 3) -> ExecutionPlan:
        """Create an execution plan for the query.
        
        Args:
            query: User's query.
            conversation_history: Recent conversation history for context.
            depth: Current nesting depth.
            max_depth: Maximum nesting depth allowed.
            
        Returns:
            Execution plan with agents to create and sequence.
        """
        logger.info(f"📋 Creating execution plan (depth {depth}/{max_depth}) for: {query[:100]}...")
        
        # Add complexity hint based on max_depth
        if max_depth >= 5:
            complexity_hint = "⚠️ VERY COMPLEX - Use 8-12 agents OR delegate"
        elif max_depth >= 4:
            complexity_hint = "⚠️ COMPLEX - Use 6-8 agents"
        elif max_depth >= 3:
            complexity_hint = "MODERATE - Use 4-6 agents"
        elif max_depth >= 2:
            complexity_hint = "SIMPLE - Use 2-4 agents"
        else:
            complexity_hint = "Very simple - 1-2 agents"
        
        logger.info(f"💡 Complexity: {complexity_hint}")
        
        # Build the planning prompt
        system_prompt = f"""You are a meta-coordinator creating an execution plan.

COMPLEXITY LEVEL: {complexity_hint}

{self.role_library.describe_roles()}

Your task:
1. Understand what the user needs
2. Decide which agent roles are required - BE GENEROUS, don't be minimalist
3. Define the sequence and what each agent should do
4. Use researcher role ONLY if current/web information is needed
5. CRITICAL: Match agent count to complexity
   - Simple factual questions: 1-2 agents
   - Questions needing analysis: 3-4 agents  
   - Multi-part tasks: 5-7 agents
   - Complex projects: 8-12 agents
   - Massive undertakings: 12+ agents or use delegation

DON'T default to just 2 agents! Most tasks need 3-6 specialized agents.

Respond with ONLY valid JSON:
{{
  "description": "brief plan description",
  "agents": [
    {{
      "role": "role_name",
      "task": "specific task for this agent"
    }}
  ]
}}

Rules:
- BE AMBITIOUS with agent count - don't be conservative!
- Break down tasks into specialized steps (each step = 1 agent)
- Use 3-6 agents for most tasks, 8+ for complex ones
- For very complex tasks (8+ agents needed), consider using coordinator/planner for delegation
- Last agent should usually be "synthesizer" to create final answer
- Each agent gets ONE specific focused task
- Only use "researcher" if web search is truly needed

Examples:

Simple (1-2 agents):
"Explain machine learning" → {{"description": "Direct explanation", "agents": [{{"role": "analyzer", "task": "Explain machine learning"}}]}}

Moderate (2-4 agents):
"Plan a 3-day trip to Paris" → {{"description": "Travel planning", "agents": [
  {{"role": "researcher", "task": "Research Paris attractions and hotels"}},
  {{"role": "planner", "task": "Create detailed 3-day itinerary"}},
  {{"role": "writer", "task": "Format travel plan with tips"}},
  {{"role": "synthesizer", "task": "Compile final travel guide"}}
]}}

Complex (5-8 agents):
"Create a business plan with market research and financial projections" → {{"description": "Comprehensive business planning", "agents": [
  {{"role": "researcher", "task": "Market research and competitor analysis"}},
  {{"role": "analyzer", "task": "Analyze market opportunities and threats"}},
  {{"role": "planner", "task": "Create business strategy and roadmap"}},
  {{"role": "analyzer", "task": "Financial projections and budgeting"}},
  {{"role": "writer", "task": "Write executive summary and mission statement"}},
  {{"role": "critic", "task": "Review and identify gaps in the plan"}},
  {{"role": "writer", "task": "Refine and polish all sections"}},
  {{"role": "synthesizer", "task": "Compile complete business plan"}}
]}}

Very Complex (8+ agents or use delegation):
"Build a complete software architecture with frontend, backend, database, and deployment strategy" → {{"description": "Software architecture design", "agents": [
  {{"role": "coordinator", "task": "Coordinate architecture design across all layers - delegate to specialists for each component"}},
  {{"role": "synthesizer", "task": "Compile complete architecture document"}}
]}}

Respond with ONLY the JSON:"""

        # Build human message with conversation context if available
        human_content = query
        if conversation_history:
            human_content = f"CONVERSATION HISTORY:\n{conversation_history}\n\nCURRENT QUESTION:\n{query}"
        
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=human_content)
        ]
        
        # Add config for Phoenix tracing
        config: RunnableConfig = {
            "run_name": "meta_coordinator_planning",
            "metadata": {"query": query[:100]},
            "tags": ["coordinator", "planning", "meta_agent"]
        }  # type: ignore
        
        # Get the plan
        content = ""
        try:
            response = self.llm.invoke(messages, config=config)
            content = str(response.content) if response.content else ""
            
            # Parse JSON
            try:
                plan_data = json.loads(content)
            except json.JSONDecodeError:
                # Extract JSON from text
                start = content.find('{')
                end = content.rfind('}') + 1
                if start >= 0 and end > start:
                    plan_data = json.loads(content[start:end])
                else:
                    raise ValueError("No JSON in response")
            
            # Validate plan
            if not plan_data.get("agents"):
                raise ValueError("No agents in plan")
            
            # Create execution plan with delegation info
            agents = []
            for agent_spec in plan_data.get("agents", []):
                role_name = agent_spec.get("role")
                task = agent_spec.get("task")
                
                if role_name and task:
                    # Get role definition to check delegation capability
                    role = self.role_library.get_role(role_name)
                    can_delegate = role.can_delegate if role else False
                    
                    agents.append({
                        "role": role_name,
                        "task": task,
                        "can_delegate": can_delegate
                    })
            
            plan = ExecutionPlan(
                description=plan_data.get("description", "Dynamic execution plan"),
                agents=agents,
                depth=depth
            )
            
            logger.info(f"✓ Created plan: {plan.description}")
            logger.info(f"✓ Agents: {[a['role'] for a in plan.agents]}")
            
            return plan
            
        except Exception as e:
            logger.error(f"✗ Failed to create plan: {e}")
            logger.error(f"✗ Response: {content[:500]}")
            
            # Fallback plan
            return self._create_fallback_plan(query)
    
    def _create_fallback_plan(self, query: str) -> ExecutionPlan:
        """Create a simple fallback plan.
        
        Args:
            query: User's query.
            
        Returns:
            Simple execution plan.
        """
        logger.warning("Using fallback plan")
        
        # Check if needs web search
        needs_web = any(word in query.lower() for word in [
            'current', 'latest', 'today', 'news', 'weather', '2024', '2025', 'now'
        ])
        
        if needs_web:
            agents = [
                {"role": "researcher", "task": "Search for current information", "can_delegate": False},
                {"role": "synthesizer", "task": "Create final answer", "can_delegate": False}
            ]
        else:
            agents = [
                {"role": "analyzer", "task": "Answer the question", "can_delegate": False}
            ]
        
        return ExecutionPlan(
            description="Fallback plan",
            agents=agents,
            depth=0
        )
