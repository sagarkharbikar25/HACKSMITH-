"""
Authentication router: Login, registration, profile, and password reset flows.
"""
import os
import secrets
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..config import settings
from ..db import get_db
from ..models import User, PasswordResetToken
from ..schemas import (
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    UserOut,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    ResetPasswordRequest,
    ResetPasswordResponse,
)
from ..security import verify_password, hash_password, create_access_token
from ..deps import get_current_user
from ..services.workflow import write_audit_log

router = APIRouter(prefix="/auth", tags=["auth"])

logger = logging.getLogger(__name__)

def send_reset_email(to_email: str, token: str) -> bool:
    """Sends password reset email via standard SMTP (e.g. Gmail) if configured."""
    if os.getenv("TESTING") == "1":
        return False
    if not (settings.SMTP_ENABLED or settings.SMTP_USER):
        return False
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        return False

    sender = settings.SMTP_FROM or settings.SMTP_USER
    frontend_base = settings.CORS_ORIGINS.split(",")[0].strip()
    if frontend_base == "*":
        frontend_base = "http://127.0.0.1:5173"
    reset_link = f"{frontend_base}/login?token={token}"

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "BrandGuard AI - Password Reset Instructions"
    msg["From"] = sender
    msg["To"] = to_email

    text_body = f"""Hello,

You recently requested a password reset for your BrandGuard AI account ({to_email}).

Click the link below to set your new password:
{reset_link}

Or copy your single-use security token:
{token}

This link and token will expire in 15 minutes.
If you did not request this reset, you can safely ignore this email.

Best regards,
BrandGuard AI Governance Team
"""
    html_body = f"""<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0E0E0B; color: #FFFFFF; padding: 30px; margin: 0;">
  <div style="max-width: 520px; margin: 0 auto; background-color: #141410; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 32px;">
    <div style="margin-bottom: 24px;">
      <span style="font-size: 20px; font-weight: bold; color: #AFE607; letter-spacing: -0.5px;">BRANDGUARD AI</span>
    </div>
    <h2 style="font-size: 18px; font-weight: 600; color: #FFFFFF; margin: 0 0 12px 0;">Reset Your Password</h2>
    <p style="font-size: 13px; color: #A1A19A; line-height: 1.6; margin: 0 0 24px 0;">
      A password reset was requested for your account (<strong style="color: #FFFFFF;">{to_email}</strong>). Click the button below to choose a new password.
    </p>
    <div style="margin-bottom: 28px;">
      <a href="{reset_link}" style="background-color: #AFE607; color: #000000; font-weight: 700; font-size: 13px; text-decoration: none; padding: 12px 24px; border-radius: 10px; display: inline-block;">
        Reset Password &rarr;
      </a>
    </div>
    <p style="font-size: 11px; color: #71716B; margin: 0 0 8px 0;">
      Or copy your single-use security token:
    </p>
    <div style="background-color: #0E0E0B; border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; padding: 10px 14px; font-family: monospace; font-size: 12px; color: #FFFFFF; word-break: break-all; margin-bottom: 20px;">
      {token}
    </div>
    <p style="font-size: 11px; color: #71716B; margin: 0 0 12px 0;">
      If the button above does not open, visit this link:
    </p>
    <p style="font-size: 11px; color: #AFE607; word-break: break-all; margin: 0 0 24px 0;">
      {reset_link}
    </p>
    <hr style="border: none; border-top: 1px solid rgba(255,255,255,0.08); margin: 24px 0;" />
    <p style="font-size: 10px; color: #71716B; margin: 0;">
      This security link expires in 15 minutes. If you did not request this reset, no action is needed and your account remains safe.
    </p>
  </div>
</body>
</html>"""
    msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(sender, [to_email], msg.as_string())
        logger.info(f"Password reset email delivered successfully to {to_email}")
        return True
    except Exception as exc:
        logger.warning(f"SMTP email delivery to {to_email} failed: {exc}")
        return False

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

@router.post("/forgot-password", response_model=ForgotPasswordResponse)
def forgot_password(req: ForgotPasswordRequest, db: Session = Depends(get_db)):
    clean_email = req.email.strip().lower()
    user = db.query(User).filter(User.email == clean_email).first()
    if not user:
        # Prevent user enumeration in production, but confirm request gracefully
        return ForgotPasswordResponse(
            message="If this email is registered, password reset instructions have been generated.",
            reset_token=None,
            expires_in_minutes=15
        )

    # Invalidate previous active tokens for this user
    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id,
        PasswordResetToken.used == False
    ).update({"used": True})

    # Generate secure random token
    raw_token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(minutes=15)

    reset_record = PasswordResetToken(
        user_id=user.id,
        token=raw_token,
        expires_at=expires_at,
        used=False
    )
    db.add(reset_record)
    db.commit()

    write_audit_log(
        db,
        actor_id=user.id,
        action="auth.forgot_password_requested",
        object_type="user",
        object_id=str(user.id),
        meta={"expires_in_minutes": 15}
    )

    email_sent = send_reset_email(user.email, raw_token)
    msg = (
        "Password reset instructions have been sent to your email."
        if email_sent
        else "Password reset instructions generated successfully."
    )

    # Security: If email was successfully sent, NEVER expose the token in the API response.
    # The user must access it exclusively from their verified email inbox.
    return ForgotPasswordResponse(
        message=msg,
        reset_token=None if email_sent else raw_token,
        expires_in_minutes=15
    )

@router.post("/reset-password", response_model=ResetPasswordResponse)
def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    if len(req.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": {"code": "PASSWORD_TOO_SHORT", "message": "Password must be at least 6 characters long.", "details": {}}}
        )

    now = datetime.utcnow()
    record = db.query(PasswordResetToken).filter(
        PasswordResetToken.token == req.token.strip(),
        PasswordResetToken.used == False,
        PasswordResetToken.expires_at > now
    ).first()

    if not record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": {"code": "INVALID_OR_EXPIRED_TOKEN", "message": "Password reset token is invalid, used, or expired.", "details": {}}}
        )

    user = db.query(User).filter(User.id == record.user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "USER_NOT_FOUND", "message": "Associated user account was not found.", "details": {}}}
        )

    user.password_hash = hash_password(req.new_password)
    record.used = True
    db.commit()

    write_audit_log(
        db,
        actor_id=user.id,
        action="auth.password_reset_completed",
        object_type="user",
        object_id=str(user.id)
    )

    return ResetPasswordResponse(
        message="Password has been successfully updated. You may now log in with your new password."
    )

@router.get("/me", response_model=UserOut)
def get_me(user: User = Depends(get_current_user)):
    return UserOut.model_validate(user)
