# Authentication

JWT-based authentication using FastAPI-Users with SQLite backend.

## Overview

| Feature | Description |
|---------|-------------|
| **JWT Tokens** | Secure bearer tokens |
| **Password Hashing** | bcrypt |
| **Guest Mode** | Temporary users (no persistence) |
| **User Profiles** | Preferences and usage stats |

## Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/register` | POST | Create account |
| `/auth/jwt/login` | POST | Login, returns JWT |
| `/auth/me` | GET | Current user info |
| `/auth/me/stats` | GET | Usage stats |
| `/profile/{username}` | GET | Get profile |
| `/profile/{username}` | PUT | Update profile |

## Data Models

### User (FastAPI-Users)

```python
User:
  - id: UUID
  - email: str (unique)
  - hashed_password: str
  - is_active, is_verified, is_superuser: bool
```

### UserProfile

```python
UserProfile:
  - username: str (unique)
  - display_name: str
  - avatar_emoji: str
  - theme: "light" | "dark"
  - is_guest: bool
  - total_tokens_used: int
  - total_cost: float
```

## Usage Stats

Calculated from database:

| Stat | Source |
|------|--------|
| `total_queries` | COUNT(conversations) |
| `total_agents_executed` | SUM(agents_used) |
| `total_tokens_used` | Accumulated per query |
| `total_cost` | Accumulated per query |

## Examples

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

# Response: {"access_token": "eyJ...", "token_type": "bearer"}
```

### Get Stats

```bash
curl http://localhost:8000/auth/me/stats \
  -H "Authorization: Bearer <token>"

# Response:
{
  "total_queries": 50,
  "total_agents_executed": 120,
  "total_tokens_used": 15000,
  "total_cost": 0.032
}
```

## Guest Mode

- Auto-created on WebSocket connect with `guest_` prefix
- Conversations NOT persisted
- Upgrade by registering with same email

## Configuration

```bash
JWT_SECRET=your-secret-key  # Required in production
```

If not set, random secret generated (tokens invalidate on restart).

## Database

```bash
# Initialize
alembic upgrade head

# Location
data/magentic.db
```
