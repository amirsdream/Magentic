#!/usr/bin/env python3
"""Quick test to check complexity analysis."""

import sys
import logging
from src.config import Config
from src.meta_agent_system import MetaAgentSystem
from src.tools import ToolManager

logging.basicConfig(level=logging.INFO)

config = Config()
tools = ToolManager().initialize_tools()
system = MetaAgentSystem(config, tools)

# Test queries
test_queries = [
    "What is Python?",
    "Plan a trip to Paris",
    "Create a comprehensive business plan with market research, financial analysis, and marketing strategy",
    "Design a complete e-commerce platform with frontend, backend, payment integration, and deployment strategy",
    "Compare different machine learning frameworks, analyze their pros and cons, and create a selection guide"
]

print("\n" + "="*80)
print("COMPLEXITY ANALYSIS TEST")
print("="*80)

for query in test_queries:
    print(f"\n📝 Query: {query}")
    depth = system._analyze_query_complexity(query)
    print(f"   Result: max_depth = {depth}\n")

print("="*80)
