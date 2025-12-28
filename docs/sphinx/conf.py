# Configuration file for the Sphinx documentation builder.
#
# For the full list of built-in configuration values, see the documentation:
# https://www.sphinx-doc.org/en/master/usage/configuration.html

import os
import sys

# Add the project root to the path for autodoc (now two levels up from sphinx/)
sys.path.insert(0, os.path.abspath('../..'))
sys.path.insert(0, os.path.abspath('../../src'))

# -- Project information -----------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#project-information

project = 'Magentic'
copyright = '2024-2025, Magentic Team'
author = 'Magentic Team'
release = '1.3.0'
version = '1.3.0'

# -- General configuration ---------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#general-configuration

extensions = [
    'sphinx.ext.autodoc',           # Auto-generate docs from docstrings
    'sphinx.ext.napoleon',          # Support Google/NumPy style docstrings
    'sphinx.ext.viewcode',          # Add links to source code
    'sphinx.ext.intersphinx',       # Link to other projects' documentation
    'sphinx.ext.autosummary',       # Generate summary tables
    'sphinx.ext.githubpages',       # Create .nojekyll for GitHub Pages
    'myst_parser',                  # Support Markdown files
]

# MyST-Parser configuration for Markdown support
myst_enable_extensions = [
    "colon_fence",      # ::: for directives
    "deflist",          # Definition lists
    "fieldlist",        # Field lists
    "tasklist",         # Task lists with checkboxes
    "strikethrough",    # ~~strikethrough~~
    "attrs_inline",     # Inline attributes
]

# Autodoc configuration
autodoc_default_options = {
    'members': True,
    'member-order': 'bysource',
    'special-members': '__init__',
    'undoc-members': True,
    'exclude-members': '__weakref__'
}
autodoc_typehints = 'description'
autodoc_mock_imports = [
    # Telemetry/observability
    'phoenix', 'openinference', 'opentelemetry',
    # LangChain ecosystem
    'langchain', 'langgraph', 'langchain_core', 'langchain_ollama',
    'langchain_openai', 'langchain_anthropic', 'langchain_qdrant',
    'langchain_community', 'langchain_text_splitters',
    # FastAPI ecosystem
    'fastapi', 'uvicorn', 'pydantic', 'starlette',
    'fastapi_users', 'fastapi_users_db_sqlalchemy',
    # Database
    'sqlalchemy', 'aiosqlite', 'alembic',
    # Vector stores
    'qdrant_client', 'chromadb', 'sentence_transformers',
    # HTTP/WebSocket
    'httpx', 'websockets', 'aiohttp',
    # Auth
    'passlib', 'jwt', 'python_jose', 'bcrypt', 'jose',
    # Utilities
    'dotenv', 'python_dotenv', 'duckduckgo_search',
    # Metrics
    'prometheus_client', 'prometheus_fastapi_instrumentator',
    # MCP
    'mcp', 'fastmcp',
]

# Suppress warnings
suppress_warnings = [
    'ref.python',
    'autodoc.import_object',
    'autodoc',
    'toc.not_readable',
]

# Napoleon settings for Google-style docstrings
napoleon_google_docstring = True
napoleon_numpy_docstring = True
napoleon_include_init_with_doc = True
napoleon_include_private_with_doc = False

# Autosummary settings
autosummary_generate = True

# Intersphinx mapping to external docs (only Python, langchain inventory is broken)
intersphinx_mapping = {
    'python': ('https://docs.python.org/3', None),
}

templates_path = ['_templates']
exclude_patterns = ['_build', 'Thumbs.db', '.DS_Store']

# Source file suffixes
source_suffix = {
    '.rst': 'restructuredtext',
    '.md': 'markdown',
}

# The master toctree document
master_doc = 'index'

# -- Options for HTML output -------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#options-for-html-output

html_theme = 'sphinx_rtd_theme'  # ReadTheDocs theme with stable sidebar
html_static_path = ['_static']
html_title = 'Magentic Documentation'
html_short_title = 'Magentic'
html_logo = None  # Add logo path if you have one
html_favicon = None  # Add favicon path if you have one

# Theme options for ReadTheDocs theme
html_theme_options = {
    'navigation_depth': 4,
    'collapse_navigation': False,  # Keep sidebar expanded
    'sticky_navigation': True,
    'includehidden': True,
    'titles_only': False,
}

# -- Options for LaTeX output ------------------------------------------------
latex_elements = {
    'papersize': 'letterpaper',
    'pointsize': '10pt',
}

# -- Options for linkcheck ---------------------------------------------------
linkcheck_ignore = [
    r'http://localhost:\d+',
    r'http://127.0.0.1:\d+',
]

# -- Custom setup ------------------------------------------------------------
def setup(app):
    # Create _static directory if it doesn't exist
    static_dir = os.path.join(os.path.dirname(__file__), '_static')
    if not os.path.exists(static_dir):
        os.makedirs(static_dir)
