"""
Authentication router: Login and current user profile.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..db import get_db
from ..models import User
from ..schemas import LoginRequest, RegisterRequest, TokenResponse, UserOut
from ..security import verify_password, hash_password, create_access_token
from ..deps import get_current_user
from ..services.workflow import write_audit_log

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email.strip().lower()).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": {"code": "INVALID_CREDENTIALS", "message": "Invalid email or password", "details": {}}}
        )

    token = create_access_token(data={"sub": str(user.id), "role": user.role, "email": user.email})
    write_audit_log(db, actor_id=user.id, action="login", object_type="user", object_id=str(user.id))

    return TokenResponse(
        token=token,
        user=UserOut.model_validate(user)
    )

@router.post("/register", response_model=TokenResponse)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == req.email.strip().lower()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": {"code": "USER_EXISTS", "message": "A user with this email address already exists", "details": {}}}
        )
    user = User(
        name=req.name.strip(),
        email=req.email.strip().lower(),
        password_hash=hash_password(req.password),
        role=req.role
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(data={"sub": str(user.id), "role": user.role, "email": user.email})
    write_audit_log(db, actor_id=user.id, action="register", object_type="user", object_id=str(user.id), meta={"role": user.role})

    return TokenResponse(
        token=token,
        user=UserOut.model_validate(user)
    )

@router.get("/me", response_model=UserOut)
def get_me(user: User = Depends(get_current_user)):
    return UserOut.model_validate(user)
