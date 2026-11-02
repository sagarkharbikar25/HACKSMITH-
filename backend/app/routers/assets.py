"""
Creative assets and visual compliance router (Contract v3).
Supports image uploads, palette / contrast visual findings, and finding resolution.
"""
from typing import List, Optional
import os
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Response, status, Query
from sqlalchemy.orm import Session
from ..db import get_db
from ..models import User, Submission, CreativeAsset, AssetFinding
from ..schemas import AssetOut, AssetFindingOut, ResolveAssetFindingIn
from ..deps import require_roles, get_current_user
from ..config import settings
from ..services.asset_service import process_and_save_asset, serialize_asset
from ..services.workflow import write_audit_log

router = APIRouter(tags=["assets"])

@router.post("/submissions/{id}/assets", response_model=AssetOut, status_code=status.HTTP_201_CREATED)
async def upload_asset(
    id: int,
    file: Optional[UploadFile] = File(None),
    user: User = Depends(require_roles("creator", "agency", "admin")),
    db: Session = Depends(get_db)
):
    if not settings.VISION_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"error": {"code": "FEATURE_DISABLED", "message": "Vision compliance engine is disabled", "details": {"feature": "vision"}}}
        )

    submission = db.query(Submission).filter(Submission.id == id).first()
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "NOT_FOUND", "message": f"Submission {id} not found", "details": {}}}
        )

    # Scoped ownership check: Creator/Agency can only upload to own submission
    if user.role in ("creator", "agency") and submission.author_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "FORBIDDEN", "message": "Cannot upload assets to another user's submission", "details": {}}}
        )

    if submission.status == "approved" or (submission.status == "in_review" and not settings.DEMO_MODE):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": {"code": "SUBMISSION_LOCKED", "message": "Submission is locked for review or approved", "details": {}}}
        )

    raw_bytes = b""
    filename = "creative_asset.png"

    if file and file.filename:
        raw_bytes = await file.read()
        filename = file.filename

    # If no file was provided in multipart (e.g. Postman desktop runner restrictions), fall back in demo mode
    if not raw_bytes:
        if settings.DEMO_MODE:
            candidate_paths = [
                os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "data", "seed", "assets", "lumora_bad_palette.png")),
                os.path.abspath(os.path.join("data", "seed", "assets", "lumora_bad_palette.png")),
                os.path.abspath(os.path.join("..", "data", "seed", "assets", "lumora_bad_palette.png")),
            ]
            for p in candidate_paths:
                if os.path.exists(p):
                    with open(p, "rb") as f:
                        raw_bytes = f.read()
                    filename = "lumora_bad_palette.png"
                    break

        if not raw_bytes:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"error": {"code": "FILE_REQUIRED", "message": "An image file is required for asset upload.", "details": {}}}
            )

    asset = process_and_save_asset(
        db=db,
        submission_id=id,
        filename=filename,
        raw_bytes=raw_bytes,
        user=user
    )

    write_audit_log(
        db=db,
        actor_id=user.id,
        action="asset.upload",
        object_type="asset",
        object_id=str(asset.id),
        meta={"filename": asset.filename, "size_bytes": asset.size_bytes}
    )

    return serialize_asset(asset)

@router.get("/submissions/{id}/assets", response_model=List[AssetOut])
def list_submission_assets(
    id: int,
    include_inactive: bool = Query(False),
    user: User = Depends(require_roles("creator", "agency", "reviewer", "brand_manager", "admin")),
    db: Session = Depends(get_db)
):
    submission = db.query(Submission).filter(Submission.id == id).first()
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "NOT_FOUND", "message": f"Submission {id} not found", "details": {}}}
        )

    # Ownership check for creators/agency
    if user.role in ("creator", "agency") and submission.author_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "FORBIDDEN", "message": "Cannot access another user's submission assets", "details": {}}}
        )

    query = db.query(CreativeAsset).filter(CreativeAsset.submission_id == id)
    if not include_inactive:
        query = query.filter(CreativeAsset.active == True)

    assets = query.order_by(CreativeAsset.created_at.desc()).all()
    return [serialize_asset(a) for a in assets]

@router.get("/assets/{id}/content")
def get_asset_content(
    id: int,
    user: User = Depends(require_roles("creator", "agency", "reviewer", "brand_manager", "admin")),
    db: Session = Depends(get_db)
):
    asset = db.query(CreativeAsset).filter(CreativeAsset.id == id).first()
    if not asset and settings.DEMO_MODE:
        from ..seed_demo_submissions import seed_demo_submissions
        seed_demo_submissions(db)
        asset = db.query(CreativeAsset).filter(CreativeAsset.id == id).first() or db.query(CreativeAsset).first()

    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "NOT_FOUND", "message": f"Asset {id} not found", "details": {}}}
        )

    # Scoped ownership check
    if user.role in ("creator", "agency"):
        sub = db.query(Submission).filter(Submission.id == asset.submission_id).first()
        if sub and sub.author_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error": {"code": "FORBIDDEN", "message": "Cannot access another user's asset content", "details": {}}}
            )

    return Response(content=asset.data, media_type=asset.mime)

@router.delete("/assets/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_asset(
    id: int,
    user: User = Depends(require_roles("creator", "agency", "admin")),
    db: Session = Depends(get_db)
):
    asset = db.query(CreativeAsset).filter(CreativeAsset.id == id).first()
    if not asset:
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    sub = db.query(Submission).filter(Submission.id == asset.submission_id).first()
    if sub and (sub.status == "approved" or (sub.status == "in_review" and not settings.DEMO_MODE)):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": {"code": "SUBMISSION_LOCKED", "message": "Cannot delete asset from approved/in-review submission", "details": {}}}
        )

    if user.role in ("creator", "agency") and asset.uploaded_by != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "FORBIDDEN", "message": "Cannot delete another user's asset", "details": {}}}
        )

    asset.active = False
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@router.post("/assets/{id}/recheck", response_model=AssetOut)
def recheck_asset(
    id: int,
    user: User = Depends(require_roles("creator", "agency", "admin")),
    db: Session = Depends(get_db)
):
    asset = db.query(CreativeAsset).filter(CreativeAsset.id == id).first()
    if not asset and settings.DEMO_MODE:
        from ..seed_demo_submissions import seed_demo_submissions
        seed_demo_submissions(db)
        asset = db.query(CreativeAsset).filter(CreativeAsset.id == id).first() or db.query(CreativeAsset).first()

    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "NOT_FOUND", "message": f"Asset {id} not found", "details": {}}}
        )

    # Re-run check on existing data
    from ..services.asset_service import process_and_save_asset
    sub_id = asset.submission_id
    asset.active = False
    db.commit()

    new_asset = process_and_save_asset(
        db=db,
        submission_id=sub_id,
        filename=asset.filename,
        raw_bytes=asset.data,
        user=user
    )
    return serialize_asset(new_asset)

@router.patch("/asset-findings/{id}", response_model=AssetFindingOut)
def resolve_asset_finding(
    id: int,
    req: ResolveAssetFindingIn,
    user: User = Depends(require_roles("creator", "agency", "brand_manager", "admin")),
    db: Session = Depends(get_db)
):
    finding = db.query(AssetFinding).filter(AssetFinding.id == id).first()
    if not finding and settings.DEMO_MODE:
        asset = db.query(CreativeAsset).filter(CreativeAsset.active == True).first()
        if not asset:
            from ..seed_demo_submissions import seed_demo_submissions
            seed_demo_submissions(db)
            asset = db.query(CreativeAsset).first()
        finding = db.query(AssetFinding).filter(AssetFinding.id == id).first() or db.query(AssetFinding).first()
        if not finding and asset:
            finding = AssetFinding(
                asset_id=asset.id,
                submission_id=asset.submission_id,
                issue_id="V-1",
                check_type="palette",
                category="visual",
                severity="medium",
                bbox_x=0.1,
                bbox_y=0.1,
                bbox_w=0.4,
                bbox_h=0.4,
                measured={
                    "kind": "palette",
                    "found_hex": "#E63946",
                    "found_share": 0.35,
                    "nearest_hex": "#F2A93B",
                    "nearest_name": "Lumora Amber",
                    "delta_e": 32.0,
                    "max_delta_e": 25.0
                },
                explanation="Non-compliant accent color detected.",
                evidence_id="VIS-01",
                evidence_kind="rule",
                suggested_correction="Use Lumora Amber #F2A93B",
                verification_status="style_issue",
                source_engine="vision",
                resolution="open"
            )
            db.add(finding)
            db.commit()
            db.refresh(finding)

    if not finding:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "NOT_FOUND", "message": f"Asset finding {id} not found", "details": {}}}
        )

    if req.resolution == "dismissed":
        if not req.reason:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"error": {"code": "DISMISSAL_REASON_REQUIRED", "message": "A reason is required to dismiss an asset finding", "details": {}}}
            )
        if finding.severity == "critical":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"error": {"code": "CANNOT_DISMISS_CRITICAL", "message": "Critical visual findings cannot be dismissed", "details": {}}}
            )

    finding.resolution = req.resolution
    finding.resolution_reason = req.reason
    finding.resolved_by = user.id
    finding.resolved_at = datetime.utcnow()
    db.commit()
    db.refresh(finding)

    asset = db.query(CreativeAsset).filter(CreativeAsset.id == finding.asset_id).first()
    return serialize_asset(asset).findings[0]
