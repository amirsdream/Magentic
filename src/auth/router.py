"""
Auth routes using fastapi-users library.
Clean, minimal routes that leverage the library's built-in functionality.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from .users import (
    fastapi_users,
    auth_backend,
    UserRead,
    UserCreate,
    UserUpdate,
    current_active_user,
    optional_current_user,
    get_async_session,
    create_guest_user,
    User,
)

# Main auth router
router = APIRouter(prefix="/auth", tags=["auth"])

# Include fastapi-users built-in routes
# POST /auth/jwt/login - Login and get JWT
# POST /auth/jwt/logout - Logout (optional, JWT is stateless)
router.include_router(
    fastapi_users.get_auth_router(auth_backend),
    prefix="/jwt",
)

# POST /auth/register - Register new user
router.include_router(
    fastapi_users.get_register_router(UserRead, UserCreate),
)

# POST /auth/forgot-password - Request password reset
# POST /auth/reset-password - Reset password with token
router.include_router(
    fastapi_users.get_reset_password_router(),
)

# POST /auth/request-verify-token - Request email verification
# POST /auth/verify - Verify email with token
router.include_router(
    fastapi_users.get_verify_router(UserRead),
)

# Users management routes
# GET /auth/users/me - Get current user
# PATCH /auth/users/me - Update current user
# GET /auth/users/{id} - Get user by ID (superuser only)
# PATCH /auth/users/{id} - Update user by ID (superuser only)
# DELETE /auth/users/{id} - Delete user (superuser only)
router.include_router(
    fastapi_users.get_users_router(UserRead, UserUpdate),
    prefix="/users",
)


# ============== Custom Routes ==============

@router.post("/guest", response_model=dict)
async def login_as_guest(session: AsyncSession = Depends(get_async_session)):
    """Create a guest session for users who don't want to register."""
    user, token = await create_guest_user(session)
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": UserRead.model_validate(user),
    }


@router.get("/me/stats")
async def get_my_stats(user: User = Depends(current_active_user)):
    """Get calculated user stats from actual usage data.
    
    - total_queries: Calculated from conversations table
    - total_agents_executed: Calculated from conversations table  
    - total_tokens_used: Accumulated in user profile on each query
    - total_cost: Accumulated in user profile on each query
    """
    from ..database import SessionLocal, UserProfile
    from sqlalchemy import text
    
    db = SessionLocal()
    try:
        # Find user_profile by username (email prefix)
        username = user.email.split('@')[0] if user.email else None
        
        if not username:
            return {
                "total_queries": 0,
                "total_agents_executed": 0,
                "total_tokens_used": 0,
                "total_cost": 0.0,
            }
        
        # Get user_profile
        user_profile = db.query(UserProfile).filter(UserProfile.username == username).first()
        
        if not user_profile:
            return {
                "total_queries": 0,
                "total_agents_executed": 0,
                "total_tokens_used": 0,
                "total_cost": 0.0,
            }
        
        # Calculate queries and agents from actual conversations data
        result = db.execute(text("""
            SELECT 
                COUNT(*) as total_queries,
                COALESCE(SUM(agents_used), 0) as total_agents_executed
            FROM conversations 
            WHERE user_id = :user_id
        """), {"user_id": user_profile.id}).fetchone()
        
        return {
            "total_queries": result[0] if result else 0,
            "total_agents_executed": result[1] if result else 0,
            "total_tokens_used": user_profile.total_tokens_used or 0,
            "total_cost": user_profile.total_cost or 0.0,
        }
    finally:
        db.close()


@router.get("/me", response_model=UserRead)
async def get_me(user: User = Depends(current_active_user)):
    """Get current user profile - shorthand for /users/me."""
    return UserRead.model_validate(user)


@router.get("/status")
async def auth_status(user: User = Depends(optional_current_user)):
    """Check authentication status."""
    if user:
        return {
            "authenticated": True,
            "user": UserRead.model_validate(user),
        }
    return {
        "authenticated": False,
        "user": None,
    }
