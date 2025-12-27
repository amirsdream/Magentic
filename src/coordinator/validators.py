"""Plan validation and fixing utilities."""

import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)


def fix_synthesizer_dependencies(agents: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Ensure synthesizers depend on all content-producing agents.
    
    Args:
        agents: List of agent specifications.
        
    Returns:
        Fixed agent list.
    """
    for i, agent in enumerate(agents):
        if agent['role'] in ['synthesizer', 'writer'] and i > 0:
            depends_on = agent.get('depends_on', [])
            
            # Convert to list if single value
            if isinstance(depends_on, (int, str)):
                depends_on = [depends_on]
            
            # Convert string deps to ints
            try:
                depends_on = [int(d) if isinstance(d, str) else d for d in depends_on]
            except (ValueError, TypeError):
                depends_on = []
            
            # If synthesizer has no dependencies, make it depend on all previous agents
            if not depends_on:
                content_producers = [
                    j for j in range(i) 
                    if agents[j]['role'] not in ['synthesizer', 'writer', 'critic']
                ]
                if content_producers:
                    agent['depends_on'] = content_producers
                    logger.info(f"🔧 Auto-fixed {agent['role']} {i}: now depends on {content_producers}")
            else:
                agent['depends_on'] = depends_on
    
    return agents


def validate_plan_logic(agents: List[Dict[str, Any]]) -> bool:
    """Validate that the plan has logical dependencies.
    
    Args:
        agents: List of agent specifications.
        
    Returns:
        True if plan is logically valid.
    """
    # Check 1: Synthesizers should not be in first layer
    for i, agent in enumerate(agents):
        if agent['role'] == 'synthesizer' and i < len(agents) - 1:
            depends_on = agent.get('depends_on', [])
            if not depends_on:
                logger.warning(f"⚠️ Synthesizer at position {i} has no dependencies")
                return False
    
    # Check 2: Detect potential redundancy (warning only)
    seen_roles = {}
    for i, agent in enumerate(agents):
        role = agent.get('role', '')
        if role in seen_roles:
            seen_roles[role].append(i)
        else:
            seen_roles[role] = [i]
    
    for role, indices in seen_roles.items():
        if len(indices) > 2 and role != 'researcher':
            logger.info(f"ℹ️  Multiple {role} agents: {indices} - ensure tasks are distinct")
    
    # Check 3: Basic dependency validation
    for i, agent in enumerate(agents):
        depends_on = agent.get('depends_on', [])
        if isinstance(depends_on, (int, str)):
            depends_on = [depends_on]
        
        for dep in depends_on:
            try:
                dep_int = int(dep) if isinstance(dep, str) else dep
            except (ValueError, TypeError):
                logger.warning(f"⚠️ Invalid dependency value: {dep}")
                continue
                
            if dep_int == i:
                logger.warning(f"⚠️ Agent {i} depends on itself - fixing")
                return False
            if dep_int >= i:
                logger.warning(f"⚠️ Agent {i} depends on future agent {dep_int} - fixing")
                return False
    
    return True


def fix_plan_logic(agents: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Fix logical issues in the plan.
    
    Args:
        agents: List of agent specifications.
        
    Returns:
        Fixed agent list.
    """
    fixed_agents = []
    synthesizers = []
    
    for agent in agents:
        if agent['role'] == 'synthesizer' and not agent.get('depends_on'):
            synthesizers.append(agent)
        else:
            fixed_agents.append(agent)
    
    # Add synthesizers at the end with dependencies
    for synth in synthesizers:
        synth['depends_on'] = list(range(len(fixed_agents)))
        fixed_agents.append(synth)
    
    return fixed_agents
