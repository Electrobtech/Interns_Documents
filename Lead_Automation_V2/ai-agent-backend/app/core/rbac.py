"""Permission guard matching the platform's RBAC — permission codes are
embedded in the JWT at login (see services/auth-service), so this is a pure
in-memory check, same as shared/src/permissions.js on the Node side."""
from __future__ import annotations

from fastapi import Depends, HTTPException

from app.core.security import AuthUser, get_current_user


def require_permission(code: str):
    async def _check(user: AuthUser = Depends(get_current_user)) -> AuthUser:
        if code not in (user.permissions or []):
            raise HTTPException(status_code=403, detail=f"Missing permission: {code}")
        return user

    return _check
