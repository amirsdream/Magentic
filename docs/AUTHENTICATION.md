# Authentication

## Overview

JWT-based authentication using FastAPI-Users with SQLite backend. Supports registered users and guest mode.

## Auth System

- **JWT Tokens** — Secure bearer tokens for API authentication
- **Password Hashing** — bcrypt for secure password storage
- **Guest Mode** — Temporary users with limited features (no history persistence)
- **User Profiles** — Separate profile data linked by username

## Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/register` | POST | Create account |
| `/auth/jwt/login` | POST | Authenticate, returns JWT token |
| `/auth/me` | GET | Get current user (requires auth) |
| `/auth/me/stats` | GET | Get usage stats (queries, tokens, cost) |
| `/profile/{username}` | GET | Get profile |
| `/profile/{username}` | PUT | Update profile |

## User Model

```python
# FastAPI-Users (auth)
User:
  - id (UUID)
  - email (unique)
  - hashed_password
  - is_active, is_verified, is_superuser

# UserProfile (app data)
UserProfile:
  - username (unique, derived from email)
  - display_name
  - avatar_emoji
  - theme ("light" | "dark")
  - is_guest
  - total_tokens_used (accumulated)
  - total_cost (accumulated)
```

## Usage Stats

Stats are calculated from actual data:
- **total_queries**: COUNT from conversations table
- **total_agents_executed**: SUM(agents_used) from conversations
- **total_tokens_used**: Accumulated per query from token tracker
- **total_cost**: Accumulated per query based on LLM pricing

## Usage

### Register
```bash
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "alice@example.com", "password": "secret123"}'
```

### Login
```bash
curl -X POST http://localhost:8000/auth/jwt/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d 'username=alice@example.com&password=secret123'
# Returns: {"access_token": "eyJ...", "token_type": "bearer"}
```

### Get Stats
```bash
curl http://localhost:8000/auth/me/stats \
  -H "Authorization: Bearer <token>"
# Returns: {"total_queries": 50, "total_agents_executed": 120, "total_tokens_used": 15000, "total_cost": 0.032}
```

### Guest Mode
Guests auto-created on WebSocket connect with `guest_` prefix. 
- Conversations NOT persisted for guests
- Upgrade to registered user to save history

## Environment Variables

```bash
JWT_SECRET=your-secret-key  # Required in production
```

If not set, a random secret is generated (tokens invalidate on restart).

## Database

```bash
# Initialize tables
python -c "from src.database import run_migrations; run_migrations()"

# Location
data/magentic.db
```
