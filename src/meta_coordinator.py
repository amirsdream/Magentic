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
    agents: List[Dict[str, Any]]  # List of {role, task, can_delegate, depends_on}
    depth: int = 0  # Nesting level (0 = root)
    
    def get_dependency_graph(self) -> Dict[int, List[int]]:
        """Build dependency graph from agent specifications.
        
        Returns:
            Dict mapping agent index to list of dependency indices.
        """
        graph = {}
        for i, agent in enumerate(self.agents):
            depends_on = agent.get('depends_on', [])
            # Convert to list if single value
            if isinstance(depends_on, int):
                depends_on = [depends_on]
            # Filter valid dependencies
            graph[i] = [d for d in depends_on if 0 <= d < len(self.agents) and d != i]
        return graph
    
    def get_execution_layers(self) -> List[List[int]]:
        """Get agents grouped by execution layer (topological sort).
        
        Returns:
            List of layers, where each layer contains agent indices that can run in parallel.
        """
        graph = self.get_dependency_graph()
        n = len(self.agents)
        
        # Calculate in-degrees
        in_degree = {i: 0 for i in range(n)}
        for deps in graph.values():
            for dep in deps:
                in_degree[dep] = in_degree.get(dep, 0)
        
        for i in range(n):
            for dep in graph.get(i, []):
                in_degree[i] += 1
        
        # Topological sort with layers
        layers = []
        remaining = set(range(n))
        
        while remaining:
            # Find all nodes with in-degree 0
            current_layer = [i for i in remaining if in_degree[i] == 0]
            
            if not current_layer:
                # Cycle detected or invalid dependencies - fallback to sequential
                logger.warning("Cycle detected in dependencies, falling back to sequential execution")
                return [[i] for i in sorted(remaining)]
            
            layers.append(current_layer)
            
            # Remove current layer and update in-degrees
            for node in current_layer:
                remaining.remove(node)
                for i in remaining:
                    if node in graph.get(i, []):
                        in_degree[i] -= 1
        
        return layers
    
    
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
        system_prompt = f"""You are a meta-coordinator creating an execution plan with parallel execution support.

COMPLEXITY LEVEL: {complexity_hint}

{self.role_library.describe_roles()}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ STRICT ROLE REQUIREMENTS - READ CAREFULLY ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You MUST use ONLY these exact role names (case-insensitive):
- researcher
- analyzer
- planner
- writer
- coder
- critic
- synthesizer
- coordinator

DO NOT invent new roles like "architect", "designer", "engineer", etc.
DO NOT use roles not in the list above.
DO NOT create multiple agents with the same role unless absolutely necessary.

If you need an "architect" → use "planner"
If you need a "designer" → use "planner" or "writer"
If you need an "engineer" → use "coder"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Your task:
1. Understand what the user needs
2. Decide which agent roles are required - BE MINIMAL for simple queries
3. Define the sequence WITH DEPENDENCIES for parallel execution
4. Use researcher role ONLY if current/web information is needed
5. CRITICAL: Match agent count to complexity
   - Very simple factual questions: 1 agent ONLY
   - Simple questions: 1-2 agents
   - Questions needing analysis: 2-3 agents  
   - Multi-part tasks: 4-6 agents
   - Complex projects: 6-10 agents
   - Massive undertakings: 10+ agents or use delegation

IMPORTANT: For simple questions that can be answered directly, use ONLY 1 agent!

PARALLELIZATION:
- Specify "depends_on" field with list of agent indices that must complete first
- Agents with empty "depends_on": [] run immediately in parallel
- Agents with "depends_on": [0, 2] wait for agents 0 and 2 to complete
- MAXIMIZE PARALLELISM: Run independent tasks (e.g., multiple researchers) simultaneously

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL: OUTPUT FORMAT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You MUST respond with ONLY a valid JSON object. No explanations, no text before or after.
Do NOT write "Here's the plan" or any introductory text.
Do NOT write explanations after the JSON.
START your response with {{ and END with }}

Required JSON format:
{{
  "description": "brief plan description",
  "agents": [
    {{
      "role": "ROLE_NAME",
      "task": "specific task",
      "depends_on": []
    }}
  ]
}}

Rules:
- ⚠️ ONLY use roles from the list above - NO made-up roles!
- BE EFFICIENT with agent count - use minimum needed
- Avoid duplicating roles unless truly necessary (e.g., 2 researchers for parallel topics is OK)
- For simple factual questions, use JUST 1 agent
- Break complex tasks into specialized steps (each step = 1 agent)
- Use 2-4 agents for typical tasks, 6+ only for genuinely complex ones
- For very complex tasks (8+ agents needed), consider using coordinator/planner for delegation
- Last agent should usually be "synthesizer" only if combining multiple outputs
- Each agent gets ONE specific focused task
- Only use "researcher" if web search is truly needed

PARALLELIZATION RULES:
- Use "depends_on": [] ONLY for truly independent tasks (e.g., researching different topics)
- Use "depends_on": [X] when task needs output from agent X
- Sequential dependencies create a chain: A → B → C → D (each depends on previous)
- Parallel tasks have NO data dependencies between them
- Example parallel: Research Python + Research Rust (independent)
- Example sequential: Research → Analyze → Plan → Write (each needs previous output)

⚠️ REMEMBER: Output ONLY JSON, nothing else!

Examples:

Simple (1-2 agents):
"Explain machine learning" → {{"description": "Direct explanation", "agents": [{{"role": "analyzer", "task": "Explain machine learning", "depends_on": []}}]}}

Moderate with PARALLELISM (2-4 agents):
"Plan a 3-day trip to Paris" → {{"description": "Travel planning", "agents": [
  {{"role": "researcher", "task": "Research Paris attractions and hotels", "depends_on": []}},
  {{"role": "planner", "task": "Create detailed 3-day itinerary", "depends_on": [0]}},
  {{"role": "writer", "task": "Format travel plan with tips", "depends_on": [1]}},
  {{"role": "synthesizer", "task": "Compile final travel guide", "depends_on": [2]}}
]}}

Complex with MAXIMUM PARALLELISM (5-8 agents):
"Create a business plan with market research and financial projections" → {{"description": "Comprehensive business planning", "agents": [
  {{"role": "researcher", "task": "Market research and competitor analysis", "depends_on": []}},
  {{"role": "researcher", "task": "Industry trends and customer research", "depends_on": []}},
  {{"role": "analyzer", "task": "Analyze market opportunities and threats", "depends_on": [0, 1]}},
  {{"role": "planner", "task": "Create business strategy and roadmap", "depends_on": [2]}},
  {{"role": "analyzer", "task": "Financial projections and budgeting", "depends_on": [2]}},
  {{"role": "writer", "task": "Write executive summary", "depends_on": [3, 4]}},
  {{"role": "critic", "task": "Review and identify gaps", "depends_on": [5]}},
  {{"role": "synthesizer", "task": "Compile complete business plan", "depends_on": [6]}}
]}}
NOTE: Agents 0,1 run in parallel, then 2 waits for both, then 3,4 run in parallel, etc.

Very Complex with HIERARCHICAL PARALLELISM (8+ agents):
"Build a complete software architecture with frontend, backend, database, and deployment" → {{"description": "Software architecture design", "agents": [
  {{"role": "researcher", "task": "Research frontend frameworks and best practices", "depends_on": []}},
  {{"role": "researcher", "task": "Research backend architectures and APIs", "depends_on": []}},
  {{"role": "researcher", "task": "Research database options and scaling", "depends_on": []}},
  {{"role": "researcher", "task": "Research deployment and CI/CD tools", "depends_on": []}},
  {{"role": "analyzer", "task": "Analyze frontend architecture requirements", "depends_on": [0]}},
  {{"role": "analyzer", "task": "Analyze backend architecture requirements", "depends_on": [1]}},
  {{"role": "analyzer", "task": "Analyze data layer requirements", "depends_on": [2]}},
  {{"role": "planner", "task": "Design overall system architecture", "depends_on": [4, 5, 6]}},
  {{"role": "writer", "task": "Document deployment strategy", "depends_on": [3, 7]}},
  {{"role": "critic", "task": "Review architecture for scalability", "depends_on": [7, 8]}},
  {{"role": "synthesizer", "task": "Compile complete architecture document", "depends_on": [9]}}
]}}
NOTE: Agents 0,1,2,3 all run in parallel (4 concurrent tasks), creating maximum efficiency!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NOW OUTPUT YOUR PLAN AS JSON ONLY - START WITH {{ AND END WITH }}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"""

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
                logger.info("✓ Successfully parsed JSON response")
            except json.JSONDecodeError:
                # Extract JSON from text
                logger.warning("⚠️ Response is not pure JSON, attempting to extract...")
                start = content.find('{')
                end = content.rfind('}') + 1
                if start >= 0 and end > start:
                    json_str = content[start:end]
                    logger.info(f"📄 Extracted JSON (first 200 chars): {json_str[:200]}...")
                    plan_data = json.loads(json_str)
                    logger.info("✓ Successfully extracted and parsed JSON")
                else:
                    logger.error(f"✗ No JSON found in response (first 500 chars): {content[:500]}...")
                    raise ValueError("No JSON in response")
            
            # Validate plan
            if not plan_data.get("agents"):
                raise ValueError("No agents in plan")
            
            # Create execution plan with delegation info AND VALIDATION
            agents = []
            invalid_roles = []
            for agent_spec in plan_data.get("agents", []):
                role_name = agent_spec.get("role")
                task = agent_spec.get("task")
                
                if role_name and task:
                    # Normalize role name to lowercase
                    role_name_lower = role_name.lower()
                    
                    # Get role definition to check delegation capability
                    role = self.role_library.get_role(role_name_lower)
                    
                    if not role:
                        # Role doesn't exist - reject it
                        invalid_roles.append(role_name)
                        logger.warning(f"⚠️ Rejecting undefined role: {role_name}")
                        continue
                    
                    can_delegate = role.can_delegate
                    
                    agents.append({
                        "role": role_name_lower,  # Use normalized name
                        "task": task,
                        "can_delegate": can_delegate
                    })
            
            # If invalid roles were found, log error
            if invalid_roles:
                logger.error(f"✗ Invalid roles rejected: {invalid_roles}")
                logger.error(f"✗ Valid roles are: {self.role_library.list_roles()}")
            
            # If no valid agents, use fallback
            if not agents:
                logger.error("✗ No valid agents in plan, using fallback")
                return self._create_fallback_plan(query)
            
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
