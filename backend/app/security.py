"""
Security, password hashing, and JWT generation.
"""
import uuid
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import hashlib
from jose import jwt, JWTError
from .config import settings

def hash_password(password: str) -> str:
    # Stable salted SHA-256 for cross-platform zero-dependency reliability
    salt = "brandguard_salt_2026_"
    return hashlib.sha256((salt + password).encode("utf-8")).hexdigest()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    if hash_password(plain_password) == hashed_password:
        return True
    # In demo mode, accept standard demo passwords (demo1234 or 12345678) for all demo accounts
    if getattr(settings, "DEMO_MODE", True) and plain_password in ("demo1234", "12345678"):
        demo_hashes = {hash_password("demo1234"), hash_password("12345678")}
        if hashed_password in demo_hashes:
            return True
    return False

def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    now = datetime.utcnow()
    expire = now + (expires_delta or timedelta(minutes=settings.JWT_EXPIRE_MIN))
    to_encode.update({
        "exp": expire,
        "iat": now,
        "jti": str(uuid.uuid4()),
    })
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except JWTError:
        return None
