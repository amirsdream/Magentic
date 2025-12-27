"""
MCP Server: GitHub Operations
Provides GitHub API access for repositories, issues, etc.
"""

import os
import logging
from typing import List, Dict, Any, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from github import Github, GithubException

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="MCP GitHub Server")

# Configuration
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
github_client = Github(GITHUB_TOKEN) if GITHUB_TOKEN else Github()


# ============================================
# Models
# ============================================

class SearchReposRequest(BaseModel):
    query: str
    max_results: int = 10


class GetRepoRequest(BaseModel):
    owner: str
    repo: str


class ListIssuesRequest(BaseModel):
    owner: str
    repo: str
    state: str = "open"
    max_results: int = 10


# ============================================
# API Endpoints
# ============================================

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    try:
        # Check GitHub API rate limit
        rate_limit = github_client.get_rate_limit()
        return {
            "status": "healthy",
            "authenticated": GITHUB_TOKEN is not None,
            "rate_limit": {
                "remaining": rate_limit.core.remaining,
                "limit": rate_limit.core.limit
            }
        }
    except Exception as e:
        logger.error(f"Health check error: {e}")
        return {"status": "degraded", "error": str(e)}


@app.get("/tools")
async def list_tools():
    """List available tools."""
    return [
        {
            "name": "search_repos",
            "description": "Search GitHub repositories",
            "parameters": {
                "query": {"type": "string", "description": "Search query"},
                "max_results": {"type": "integer", "description": "Maximum results", "default": 10}
            }
        },
        {
            "name": "get_repo",
            "description": "Get repository details",
            "parameters": {
                "owner": {"type": "string", "description": "Repository owner"},
                "repo": {"type": "string", "description": "Repository name"}
            }
        },
        {
            "name": "list_issues",
            "description": "List repository issues",
            "parameters": {
                "owner": {"type": "string", "description": "Repository owner"},
                "repo": {"type": "string", "description": "Repository name"},
                "state": {"type": "string", "description": "Issue state", "default": "open"},
                "max_results": {"type": "integer", "description": "Maximum results", "default": 10}
            }
        }
    ]


@app.post("/tools/search_repos")
async def search_repos(request: SearchReposRequest):
    """Search GitHub repositories."""
    try:
        results = github_client.search_repositories(
            query=request.query,
            sort="stars",
            order="desc"
        )
        
        repos = []
        for idx, repo in enumerate(results):
            if idx >= request.max_results:
                break
            
            repos.append({
                "name": repo.name,
                "full_name": repo.full_name,
                "description": repo.description,
                "url": repo.html_url,
                "stars": repo.stargazers_count,
                "forks": repo.forks_count,
                "language": repo.language,
                "updated_at": repo.updated_at.isoformat() if repo.updated_at else None
            })
        
        logger.info(f"✓ Search repos: {request.query} ({len(repos)} results)")
        return {
            "query": request.query,
            "results": repos,
            "count": len(repos)
        }
        
    except GithubException as e:
        logger.error(f"GitHub API error: {e}")
        raise HTTPException(status_code=e.status, detail=e.data.get("message", str(e)))
    except Exception as e:
        logger.error(f"Search error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/tools/get_repo")
async def get_repo(request: GetRepoRequest):
    """Get repository details."""
    try:
        repo = github_client.get_repo(f"{request.owner}/{request.repo}")
        
        result = {
            "name": repo.name,
            "full_name": repo.full_name,
            "description": repo.description,
            "url": repo.html_url,
            "stars": repo.stargazers_count,
            "forks": repo.forks_count,
            "watchers": repo.watchers_count,
            "language": repo.language,
            "created_at": repo.created_at.isoformat() if repo.created_at else None,
            "updated_at": repo.updated_at.isoformat() if repo.updated_at else None,
            "topics": repo.get_topics(),
            "license": repo.license.name if repo.license else None
        }
        
        logger.info(f"✓ Get repo: {request.owner}/{request.repo}")
        return result
        
    except GithubException as e:
        logger.error(f"GitHub API error: {e}")
        raise HTTPException(status_code=e.status, detail=e.data.get("message", str(e)))
    except Exception as e:
        logger.error(f"Get repo error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/tools/list_issues")
async def list_issues(request: ListIssuesRequest):
    """List repository issues."""
    try:
        repo = github_client.get_repo(f"{request.owner}/{request.repo}")
        issues = repo.get_issues(state=request.state)
        
        results = []
        for idx, issue in enumerate(issues):
            if idx >= request.max_results:
                break
            
            # Skip pull requests
            if issue.pull_request:
                continue
            
            results.append({
                "number": issue.number,
                "title": issue.title,
                "state": issue.state,
                "url": issue.html_url,
                "user": issue.user.login if issue.user else None,
                "created_at": issue.created_at.isoformat() if issue.created_at else None,
                "updated_at": issue.updated_at.isoformat() if issue.updated_at else None,
                "labels": [label.name for label in issue.labels],
                "comments": issue.comments
            })
        
        logger.info(f"✓ List issues: {request.owner}/{request.repo} ({len(results)} results)")
        return {
            "owner": request.owner,
            "repo": request.repo,
            "state": request.state,
            "results": results,
            "count": len(results)
        }
        
    except GithubException as e:
        logger.error(f"GitHub API error: {e}")
        raise HTTPException(status_code=e.status, detail=e.data.get("message", str(e)))
    except Exception as e:
        logger.error(f"List issues error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
