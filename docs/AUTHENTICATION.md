# Authentication

## Overview

SQLite-based auth with bcrypt password hashing. Supports registered users and guests.

## Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/register` | POST | Create account |
| `/login` | POST | Authenticate |
| `/profile/{username}` | GET | Get profile |
| `/profile/{username}` | PUT | Update profile |

## User Model

```python
UserProfile:
  - username (unique)
  - password_hash (bcrypt, null for guests)
  - is_guest
  - display_name
  - avatar_emoji
  - theme
  - total_queries
  - total_agents_executed
```

## Usage

### Register
```bash
curl -X POST http://localhost:8000/register \
  -H "Content-Type: application/json" \
  -d '{"username": "alice", "password": "secret123"}'
```

### Login
```bash
curl -X POST http://localhost:8000/login \
  -H "Content-Type: application/json" \
  -d '{"username": "alice", "password": "secret123"}'
```

### Guest Mode
Guests auto-created on WebSocket connect. Conversations not persisted.

## Database

```bash
# Initialize
alembic upgrade head

# Reset
python reset_db.py
```

Location: `data/magentic.db`
