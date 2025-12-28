Quick Start
===========

Get Magentic running in 3 commands:

.. code-block:: bash

   git clone https://github.com/amirsdream/Magentic.git && cd Magentic
   chmod +x magentic.sh && ./magentic.sh setup
   ./magentic.sh start

Then open http://localhost:3000

Requirements
------------

* Python 3.11+
* Node.js 18+ (for frontend)
* Docker (optional, for MCP services)

Configuration
-------------

Edit ``.env`` to configure your LLM:

.. code-block:: bash

   # Ollama (default, free, local)
   LLM_PROVIDER=ollama
   OLLAMA_MODEL=llama3.2:1b

   # OpenAI
   LLM_PROVIDER=openai
   OPENAI_API_KEY=sk-...
   OPENAI_MODEL=gpt-4o

   # Claude
   LLM_PROVIDER=claude
   ANTHROPIC_API_KEY=sk-ant-...
   ANTHROPIC_MODEL=claude-sonnet-4-20250514

All Commands
------------

.. code-block:: bash

   ./magentic.sh setup      # First-time setup
   ./magentic.sh start      # Start all services
   ./magentic.sh stop       # Stop all services
   ./magentic.sh restart    # Restart all services
   ./magentic.sh status     # Show service status
   ./magentic.sh cli        # Interactive CLI mode
   ./magentic.sh help       # Show all commands

Optional Features
-----------------

.. code-block:: bash

   ENABLE_RAG=true          # Document retrieval
   ENABLE_MCP=true          # MCP tools (requires Docker)
   ENABLE_METRICS=true      # Prometheus metrics

Next Steps
----------

* Read the :doc:`index` for full documentation
* Try the **Swagger UI** at http://localhost:8000/docs for API testing
* Check `Architecture <https://github.com/amirsdream/Magentic/blob/main/docs/ARCHITECTURE.md>`_ for system design
* Browse the :doc:`api/index` for code reference
