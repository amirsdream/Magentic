"""
MCP Server: Web Search (via SearXNG)
Provides web search capabilities using self-hosted SearXNG meta-search engine.

SearXNG aggregates results from 70+ search engines including:
- Google, Bing, DuckDuckGo, Yandex, Brave, Qwant
- Google News, Bing News
- Wikipedia, Wikidata
- arXiv, Google Scholar, Semantic Scholar
- GitHub, StackOverflow, PyPI, NPM
- And many more...
"""

import os
import logging
import time
from typing import List, Dict, Any, Optional

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="MCP Web Search Server (SearXNG)")

# Configuration
MAX_RESULTS = int(os.getenv("MAX_RESULTS", 10))
TIMEOUT = int(os.getenv("TIMEOUT", 30))
SEARXNG_URL = os.getenv("SEARXNG_URL", "http://searxng:8080")

# Simple cache for search results (TTL: 5 minutes)
_search_cache: Dict[str, tuple] = {}
CACHE_TTL = 300


def _get_cached_results(query: str, search_type: str = "general") -> Optional[Dict]:
    """Get cached results if available and not expired."""
    cache_key = f"{search_type}:{query}"
    if cache_key in _search_cache:
        timestamp, results = _search_cache[cache_key]
        if time.time() - timestamp < CACHE_TTL:
            logger.info(f"✓ Cache hit for: {query}")
            return results
        else:
            del _search_cache[cache_key]
    return None


def _cache_results(query: str, results: Dict, search_type: str = "general"):
    """Cache search results."""
    cache_key = f"{search_type}:{query}"
    _search_cache[cache_key] = (time.time(), results)
    if len(_search_cache) > 100:
        oldest_key = min(_search_cache, key=lambda k: _search_cache[k][0])
        del _search_cache[oldest_key]


# ============================================
# Models
# ============================================

class SearchRequest(BaseModel):
    query: str
    max_results: int = 5
    engines: Optional[str] = None
    language: str = "en"


class NewsSearchRequest(BaseModel):
    query: str
    max_results: int = 5
    language: str = "en"


class ImageSearchRequest(BaseModel):
    query: str
    max_results: int = 5


class AcademicSearchRequest(BaseModel):
    query: str
    max_results: int = 5


class CodeSearchRequest(BaseModel):
    query: str
    max_results: int = 5
    platform: str = "all"


# ============================================
# SearXNG Client
# ============================================

async def searxng_search(
    query: str,
    categories: Optional[str] = None,
    engines: Optional[str] = None,
    max_results: int = 10,
    language: str = "en"
) -> List[Dict[str, Any]]:
    """Execute search via SearXNG API."""
    
    params = {
        "q": query,
        "format": "json",
        "language": language,
    }
    
    if categories:
        params["categories"] = categories
    if engines:
        params["engines"] = engines
        
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            response = await client.get(f"{SEARXNG_URL}/search", params=params)
            response.raise_for_status()
            data = response.json()
            
            results = data.get("results", [])[:max_results]
            
            normalized = []
            for r in results:
                normalized.append({
                    "title": r.get("title", ""),
                    "url": r.get("url", ""),
                    "snippet": r.get("content", ""),
                    "engine": r.get("engine", "unknown"),
                    "score": r.get("score", 0),
                    "category": r.get("category", "general"),
                    "published_date": r.get("publishedDate"),
                    "thumbnail": r.get("thumbnail"),
                    "author": r.get("author"),
                })
            
            return normalized
            
    except httpx.TimeoutException:
        logger.error(f"SearXNG timeout for query: {query}")
        raise HTTPException(status_code=504, detail="Search timeout")
    except httpx.HTTPError as e:
        logger.error(f"SearXNG HTTP error: {e}")
        raise HTTPException(status_code=502, detail=f"Search backend error: {e}")
    except Exception as e:
        logger.error(f"SearXNG error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# API Endpoints
# ============================================

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            response = await client.get(f"{SEARXNG_URL}/healthz")
            searxng_healthy = response.status_code == 200
    except:
        searxng_healthy = False
        
    return {
        "status": "healthy" if searxng_healthy else "degraded",
        "searxng": "connected" if searxng_healthy else "disconnected",
        "searxng_url": SEARXNG_URL
    }


@app.get("/tools")
async def list_tools():
    """List available tools."""
    return [
        {
            "name": "search",
            "description": "Search the web using multiple search engines (Google, Bing, DuckDuckGo, Yandex, Brave, etc.)",
            "parameters": {
                "query": {"type": "string", "description": "Search query"},
                "max_results": {"type": "integer", "description": "Maximum number of results", "default": 5},
                "engines": {"type": "string", "description": "Comma-separated engines: google,bing,duckduckgo,yandex,brave", "default": None},
                "language": {"type": "string", "description": "Language code (en, de, fr, etc.)", "default": "en"}
            }
        },
        {
            "name": "search_news",
            "description": "Search news articles from Google News, Bing News, and other news sources",
            "parameters": {
                "query": {"type": "string", "description": "Search query"},
                "max_results": {"type": "integer", "description": "Maximum number of results", "default": 5},
                "language": {"type": "string", "description": "Language code", "default": "en"}
            }
        },
        {
            "name": "search_images",
            "description": "Search for images using Google Images, Bing Images, etc.",
            "parameters": {
                "query": {"type": "string", "description": "Search query"},
                "max_results": {"type": "integer", "description": "Maximum number of results", "default": 5}
            }
        },
        {
            "name": "search_academic",
            "description": "Search academic papers and research from arXiv, Google Scholar, Semantic Scholar",
            "parameters": {
                "query": {"type": "string", "description": "Search query"},
                "max_results": {"type": "integer", "description": "Maximum number of results", "default": 5}
            }
        },
        {
            "name": "search_code",
            "description": "Search code repositories and programming Q&A from GitHub, StackOverflow, PyPI, NPM",
            "parameters": {
                "query": {"type": "string", "description": "Search query"},
                "max_results": {"type": "integer", "description": "Maximum number of results", "default": 5},
                "platform": {"type": "string", "description": "Platform: github, stackoverflow, pypi, npm, or all", "default": "all"}
            }
        },
        {
            "name": "search_wiki",
            "description": "Search Wikipedia and Wikidata for encyclopedic information",
            "parameters": {
                "query": {"type": "string", "description": "Search query"},
                "max_results": {"type": "integer", "description": "Maximum number of results", "default": 5}
            }
        }
    ]


@app.post("/tools/search")
async def search(request: SearchRequest):
    """Perform general web search."""
    max_results = min(request.max_results, MAX_RESULTS)
    
    cached = _get_cached_results(request.query, "general")
    if cached:
        return cached
    
    results = await searxng_search(
        query=request.query,
        categories="general",
        engines=request.engines,
        max_results=max_results,
        language=request.language
    )
    
    response = {
        "query": request.query,
        "results": results,
        "count": len(results),
        "source": "searxng"
    }
    
    _cache_results(request.query, response, "general")
    logger.info(f"✓ Search completed: {request.query} ({len(results)} results)")
    return response


@app.post("/tools/search_news")
async def search_news(request: NewsSearchRequest):
    """Search news articles."""
    max_results = min(request.max_results, MAX_RESULTS)
    
    cached = _get_cached_results(request.query, "news")
    if cached:
        return cached
    
    results = await searxng_search(
        query=request.query,
        categories="news",
        max_results=max_results,
        language=request.language
    )
    
    response = {
        "query": request.query,
        "results": results,
        "count": len(results),
        "source": "searxng"
    }
    
    _cache_results(request.query, response, "news")
    logger.info(f"✓ News search completed: {request.query} ({len(results)} results)")
    return response


@app.post("/tools/search_images")
async def search_images(request: ImageSearchRequest):
    """Search for images."""
    max_results = min(request.max_results, MAX_RESULTS)
    
    cached = _get_cached_results(request.query, "images")
    if cached:
        return cached
    
    results = await searxng_search(
        query=request.query,
        categories="images",
        max_results=max_results
    )
    
    response = {
        "query": request.query,
        "results": results,
        "count": len(results),
        "source": "searxng"
    }
    
    _cache_results(request.query, response, "images")
    logger.info(f"✓ Image search completed: {request.query} ({len(results)} results)")
    return response


@app.post("/tools/search_academic")
async def search_academic(request: AcademicSearchRequest):
    """Search academic papers and research."""
    max_results = min(request.max_results, MAX_RESULTS)
    
    cached = _get_cached_results(request.query, "academic")
    if cached:
        return cached
    
    results = await searxng_search(
        query=request.query,
        categories="science",
        engines="arxiv,google scholar,semantic scholar",
        max_results=max_results
    )
    
    response = {
        "query": request.query,
        "results": results,
        "count": len(results),
        "source": "searxng"
    }
    
    _cache_results(request.query, response, "academic")
    logger.info(f"✓ Academic search completed: {request.query} ({len(results)} results)")
    return response


@app.post("/tools/search_code")
async def search_code(request: CodeSearchRequest):
    """Search code repositories and programming Q&A."""
    max_results = min(request.max_results, MAX_RESULTS)
    
    cache_key = f"code:{request.platform}"
    cached = _get_cached_results(request.query, cache_key)
    if cached:
        return cached
    
    platform_engines = {
        "github": "github",
        "stackoverflow": "stackoverflow",
        "pypi": "pypi",
        "npm": "npm",
        "all": "github,stackoverflow,pypi,npm"
    }
    engines = platform_engines.get(request.platform.lower(), "github,stackoverflow,pypi,npm")
    
    results = await searxng_search(
        query=request.query,
        categories="it",
        engines=engines,
        max_results=max_results
    )
    
    response = {
        "query": request.query,
        "results": results,
        "count": len(results),
        "platform": request.platform,
        "source": "searxng"
    }
    
    _cache_results(request.query, response, cache_key)
    logger.info(f"✓ Code search completed: {request.query} ({len(results)} results)")
    return response


@app.post("/tools/search_wiki")
async def search_wiki(request: SearchRequest):
    """Search Wikipedia and Wikidata."""
    max_results = min(request.max_results, MAX_RESULTS)
    
    cached = _get_cached_results(request.query, "wiki")
    if cached:
        return cached
    
    results = await searxng_search(
        query=request.query,
        engines="wikipedia,wikidata",
        max_results=max_results,
        language=request.language
    )
    
    response = {
        "query": request.query,
        "results": results,
        "count": len(results),
        "source": "searxng"
    }
    
    _cache_results(request.query, response, "wiki")
    logger.info(f"✓ Wiki search completed: {request.query} ({len(results)} results)")
    return response
