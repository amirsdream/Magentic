"""Meta-agent system - dynamically creates and executes agents based on coordinator's plan."""

import logging
import json
from typing import Dict, Any, List
from pathlib import Path

from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_core.tools import BaseTool
from langchain_core.runnables import RunnableConfig
from langchain_ollama import ChatOllama

from .config import Config
from .meta_coordinator import MetaCoordinator
from .role_library import RoleLibrary
from .visualization import ExecutionVisualizer

logger = logging.getLogger(__name__)


class MetaAgentSystem:
    """Dynamic meta-agent system."""
    
    def __init__(self, config: Config, tools: List[BaseTool]):
        """Initialize meta-agent system.
        
        Args:
            config: Application configuration.
            tools: Available tools.
        """
        self.config = config
        self.tools = tools
        self.coordinator = MetaCoordinator(config)
        self.role_library = RoleLibrary()
        self.llm = ChatOllama(
            model=config.ollama_model,
            temperature=config.ollama_temperature
        )
        # Conversation memory
        self.conversation_history: List[Dict[str, str]] = []
        # Visualization
        self.visualizer = ExecutionVisualizer()
        # Hierarchical execution settings - dynamic based on query complexity
        self.absolute_max_depth = 5  # Safety limit to prevent infinite recursion
    
    def process_query(self, query: str, depth: int = 0, max_depth: int | None = None) -> Dict[str, Any]:
        """Process a query using dynamic agent creation.
        
        Args:
            query: User's query.
            depth: Current execution depth (for hierarchical agents).
            max_depth: Maximum depth for this query branch (auto-determined if None).
            
        Returns:
            Result dictionary with final answer and execution trace.
        """
        # Determine max_depth dynamically based on query complexity (first call only)
        if max_depth is None:
            max_depth = self._analyze_query_complexity(query)
            logger.info(f"🎯 Query complexity analysis: max_depth={max_depth}")
        
        indent = "  " * depth
        logger.info(f"{indent}🚀 Processing query (depth {depth}/{max_depth}): {query[:100]}...")
        
        # Build context from conversation history (only at root level)
        context = self._build_context() if depth == 0 else ""
        
        # Step 1: Coordinator creates execution plan (with history context)
        plan = self.coordinator.create_execution_plan(query, context, depth=depth, max_depth=max_depth)
        
        # Display execution plan as tree (only at root level)
        if depth == 0:
            self.visualizer.display_plan_tree(plan.description, plan.agents, depth=depth, max_depth=max_depth)
        
        # Step 2: Execute plan sequentially
        trace = []
        outputs = []
        
        for i, agent_spec in enumerate(plan.agents, 1):
            role_name = agent_spec.get("role")
            task = agent_spec.get("task")
            
            # Skip if missing required fields
            if not role_name or not task:
                logger.error(f"Invalid agent spec: {agent_spec}")
                continue
            
            logger.info(f"\n{'='*60}")
            logger.info(f"🤖 Step {i}: {role_name.upper()}")
            logger.info(f"Task: {task}")
            logger.info(f"{'='*60}")
            
            # Display progress
            self.visualizer.display_execution_progress(
                current_step=i,
                total_steps=len(plan.agents),
                role=role_name,
                task=task,
                status="running"
            )
            
            # Get role definition
            role = self.role_library.get_role(role_name)
            if not role:
                logger.error(f"Unknown role: {role_name}")
                continue
            
            # Execute agent
            output = self._execute_agent(role, task, query, outputs, depth=depth, max_depth=max_depth)
            
            outputs.append(output)
            trace.append({
                "step": i,
                "role": role_name,
                "task": task,
                "output": output[:200] + "..." if len(output) > 200 else output
            })
        
        # Final answer is the last output
        final_answer = outputs[-1] if outputs else "No output generated"
        
        # Update conversation history
        self.conversation_history.append({"role": "user", "content": query})
        self.conversation_history.append({"role": "assistant", "content": final_answer})
        logger.info(f"💾 Conversation history: {len(self.conversation_history)} messages")
        
        # Create result
        result = {
            "final_answer": final_answer,
            "trace": trace,
            "plan": {
                "description": plan.description,
                "agents": [a["role"] for a in plan.agents]
            }
        }
        
        # Display summary
        self.visualizer.display_summary(result)
        
        return result
    
    def _execute_agent(self, role, task: str, original_query: str, previous_outputs: List[str], depth: int = 0, max_depth: int = 3) -> str:
        """Execute a single agent.
        
        Args:
            role: Agent role definition.
            task: Specific task for this agent.
            original_query: Original user query.
            previous_outputs: Outputs from previous agents.
            depth: Current execution depth.
            max_depth: Maximum execution depth for this query.
            
        Returns:
            Agent's output.
        """
        # Build context
        context_parts = [f"Original question: {original_query}"]
        
        # Add conversation history if available
        if self.conversation_history:
            context_parts.append("\nConversation history (recent):")
            # Last 2 exchanges (4 messages)
            recent = self.conversation_history[-4:]
            for msg in recent:
                role_label = "User" if msg["role"] == "user" else "Assistant"
                content = msg["content"][:150] + "..." if len(msg["content"]) > 150 else msg["content"]
                context_parts.append(f"  {role_label}: {content}")
        
        if previous_outputs:
            context_parts.append("\nPrevious agent outputs:")
            for i, output in enumerate(previous_outputs, 1):
                context_parts.append(f"{i}. {output}")
        
        context = "\n".join(context_parts)
        
        # Build messages
        system_msg = SystemMessage(content=role.system_prompt)
        task_msg = HumanMessage(content=f"{context}\n\nYour task: {task}")
        
        # Check if agent can and should delegate
        if role.can_delegate and depth < max_depth:
            # Add delegation instructions
            delegation_prompt = f"""
{context}

Your task: {task}

You have the ability to delegate work to specialized sub-agents. 
If this task would benefit from delegation, respond with JSON:
{{
  "needs_delegation": true,
  "subtasks": [
    {{"role": "role_name", "task": "specific task"}},
    ...
  ]
}}

Otherwise, complete the task directly and respond with your normal output (not JSON).
"""
            task_msg = HumanMessage(content=delegation_prompt)
        
        # Add metadata for Phoenix tracing
        metadata = {
            "agent_role": role.name,
            "agent_task": task,
            "has_tools": role.needs_tools
        }
        config: RunnableConfig = {
            "run_name": f"{role.name}_agent",  # Unique name in Phoenix
            "metadata": metadata,
            "tags": [role.name, "meta_agent"]
        }  # type: ignore
        
        # Execute with or without tools
        if role.needs_tools:
            llm_with_tools = self.llm.bind_tools(self.tools)
            logger.info(f"🔧 {role.name} has access to web search")
            
            response = llm_with_tools.invoke([system_msg, task_msg], config=config)
            
            # Check for tool calls
            if hasattr(response, 'tool_calls') and response.tool_calls:
                logger.info(f"🔍 {role.name} is calling {len(response.tool_calls)} tool(s)")
                
                # Execute tools
                tool_results = []
                for tool_call in response.tool_calls:
                    # Handle different tool_call formats
                    if isinstance(tool_call, dict):
                        tool_name = tool_call.get('name', 'unknown')
                        tool_args = tool_call.get('args', {})
                    else:
                        tool_name = getattr(tool_call, 'name', None) or getattr(tool_call, 'type', 'unknown')
                        tool_args = getattr(tool_call, 'args', None) or getattr(tool_call, 'arguments', {})
                    
                    logger.info(f"   └─ Tool: {tool_name}")
                    logger.info(f"   └─ Args: {tool_args}")
                    logger.debug(f"   └─ Full tool_call: {tool_call}")
                    
                    # Find and execute tool
                    tool_found = False
                    for tool in self.tools:
                        if tool.name == tool_name:
                            tool_found = True
                            try:
                                logger.info(f"   └─ Executing {tool_name}...")
                                result = tool.invoke(tool_args)
                                tool_results.append(result)
                                logger.info(f"="*60)
                                logger.info(f"🔍 WEB SEARCH RESULT:")
                                logger.info(f"="*60)
                                logger.info(result)
                                logger.info(f"="*60)
                            except Exception as e:
                                logger.error(f"   └─ Tool error: {e}")
                                tool_results.append(f"Error executing {tool_name}: {e}")
                    
                    if not tool_found:
                        logger.warning(f"   └─ Tool '{tool_name}' not found in available tools")
                        logger.info(f"   └─ Available tools: {[t.name for t in self.tools]}")
                
                # Get final response with tool results
                if tool_results:
                    tool_context = "\n\n".join([f"Search result {i+1}:\n{r}" for i, r in enumerate(tool_results)])
                    logger.info(f"📥 {role.name} processing {len(tool_results)} tool result(s)")
                    final_config: RunnableConfig = {
                        "run_name": f"{role.name}_synthesize",
                        "metadata": {**metadata, "processing_tool_results": True},
                        "tags": [role.name, "synthesis", "meta_agent"]
                    }  # type: ignore
                    final_response = self.llm.invoke([
                        system_msg,
                        task_msg,
                        AIMessage(content=f"Based on these search results:\n\n{tool_context}\n\nProvide a comprehensive answer.")
                    ], config=final_config)
                    return str(final_response.content)
            
            return str(response.content)
        else:
            response = self.llm.invoke([system_msg, task_msg], config=config)
            response_content = str(response.content)
            
            # Check if delegation was requested (and is allowed)
            if role.can_delegate and depth < max_depth:
                try:
                    # Try to parse as JSON delegation request
                    delegation_data = json.loads(response_content)
                    if delegation_data.get("needs_delegation") and delegation_data.get("subtasks"):
                        logger.info(f"🔀 {role.name} is delegating to {len(delegation_data['subtasks'])} sub-agents (depth {depth+1})")
                        
                        # Execute sub-agents recursively
                        sub_results = []
                        for subtask_spec in delegation_data['subtasks']:
                            sub_role_name = subtask_spec.get("role")
                            sub_task = subtask_spec.get("task")
                            
                            if not sub_role_name or not sub_task:
                                continue
                            
                            logger.info(f"  └─ Delegating to {sub_role_name}: {sub_task[:60]}...")
                            
                            # Process sub-query recursively with same max_depth
                            sub_result = self.process_query(sub_task, depth=depth + 1, max_depth=max_depth)
                            sub_results.append(f"{sub_role_name}: {sub_result['final_answer']}")
                        
                        # Synthesize sub-results
                        if sub_results:
                            synthesis_msg = HumanMessage(content=f"""Original task: {task}

Sub-agent results:
{chr(10).join([f"{i+1}. {r}" for i, r in enumerate(sub_results)])}

Combine these results to complete your original task.""")
                            
                            final_response = self.llm.invoke([system_msg, synthesis_msg], config=config)
                            return str(final_response.content)
                except json.JSONDecodeError:
                    # Not JSON, return as-is
                    pass
            
            return response_content
    
    def _build_context(self) -> str:
        """Build conversation context from history.
        
        Returns:
            Formatted conversation history.
        """
        if not self.conversation_history:
            return ""
        
        # Last 2 exchanges (4 messages) to keep context manageable
        recent = self.conversation_history[-4:]
        lines = []
        for msg in recent:
            role_label = "User" if msg["role"] == "user" else "Assistant"
            content = msg["content"][:150] + "..." if len(msg["content"]) > 150 else msg["content"]
            lines.append(f"{role_label}: {content}")
        
        return "\n".join(lines) if lines else ""
    
    def clear_memory(self) -> None:
        """Clear conversation history."""
        self.conversation_history.clear()
        logger.info("💾 Conversation memory cleared")
    
    def get_memory_summary(self) -> Dict[str, Any]:
        """Get conversation memory summary.
        
        Returns:
            Summary with message count and preview.
        """
        return {
            "message_count": len(self.conversation_history),
            "exchanges": len(self.conversation_history) // 2,
            "preview": self.conversation_history[-2:] if self.conversation_history else []
        }
    
    def generate_execution_graph(self, result: Dict[str, Any], auto_open: bool = True) -> str:
        """Generate interactive HTML graph of last execution.
        
        Args:
            result: Execution result dictionary.
            auto_open: Whether to auto-open in browser.
            
        Returns:
            Path to generated HTML file.
        """
        graph_path = self.visualizer.create_execution_graph(
            plan_description=result["plan"]["description"],
            agents=[{"role": r, "task": ""} for r in result["plan"]["agents"]],
            trace=result["trace"]
        )
        
        if auto_open:
            import webbrowser
            webbrowser.open(f"file://{Path(graph_path).absolute()}")
            logger.info("🌐 Opened graph in browser")
        
        return graph_path
    
    def show_memory_visualization(self) -> None:
        """Display conversation memory visualization."""
        self.visualizer.show_memory_visualization(self.conversation_history)
    
    def _analyze_query_complexity(self, query: str) -> int:
        """Analyze query to determine appropriate max execution depth.
        
        Args:
            query: User's query.
            
        Returns:
            Recommended max depth (1-5).
        """
        query_lower = query.lower()
        
        # Complexity indicators
        complexity_score = 0
        
        # Multi-step indicators
        multi_step_words = ['plan', 'design', 'create', 'build', 'develop', 'comprehensive', 
                           'complete', 'detailed', 'step-by-step', 'workflow', 'process',
                           'strategy', 'roadmap', 'architecture', 'system']
        complexity_score += sum(2 for word in multi_step_words if word in query_lower)
        
        # Comparison/analysis indicators
        analysis_words = ['compare', 'analyze', 'evaluate', 'assess', 'review', 
                         'investigate', 'research', 'study', 'examine']
        complexity_score += sum(1.5 for word in analysis_words if word in query_lower)
        
        # Multiple domains
        if ' and ' in query_lower:
            complexity_score += len(query_lower.split(' and ')) - 1
        
        # Long queries tend to be more complex
        if len(query.split()) > 20:
            complexity_score += 2
        elif len(query.split()) > 10:
            complexity_score += 1
        
        # Questions with multiple parts
        question_marks = query.count('?')
        if question_marks > 1:
            complexity_score += question_marks
        
        # Map complexity score to depth with detailed logging
        if complexity_score >= 8:
            depth = min(5, self.absolute_max_depth)
            level = "Very Complex"
        elif complexity_score >= 5:
            depth = min(4, self.absolute_max_depth)
            level = "Complex"
        elif complexity_score >= 3:
            depth = min(3, self.absolute_max_depth)
            level = "Moderate"
        elif complexity_score >= 1:
            depth = min(2, self.absolute_max_depth)
            level = "Simple"
        else:
            depth = 1
            level = "Very Simple"
        
        logger.info(f"📊 Complexity: {level} (score: {complexity_score:.1f}) → max_depth: {depth}")
        
        return depth
