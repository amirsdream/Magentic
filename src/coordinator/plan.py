"""Execution plan data structures."""

import logging
from typing import List, Dict, Any
from dataclasses import dataclass

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
            elif isinstance(depends_on, str):
                try:
                    depends_on = [int(depends_on)]
                except ValueError:
                    depends_on = []
            
            # Convert all elements to integers and filter valid dependencies
            try:
                depends_on_ints = [int(d) for d in depends_on]
                graph[i] = [d for d in depends_on_ints if 0 <= d < len(self.agents) and d != i]
            except (ValueError, TypeError):
                logger.warning(f"Invalid depends_on for agent {i}: {depends_on}")
                graph[i] = []
                
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
                # Cycle detected - fallback to sequential
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
