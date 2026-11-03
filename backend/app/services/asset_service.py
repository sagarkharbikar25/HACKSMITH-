"""
Creative asset upload pipeline, image normalisation, and visual/contrast compliance checking.
"""
import io
import hashlib
from typing import List, Dict, Any, Tuple
from datetime import datetime
from PIL import Image, ImageOps
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from ..config import settings
from ..models import User, Submission, CreativeAsset, AssetFinding, Rule
from ..schemas import (
    AssetOut, AssetFindingOut, BBox, PaletteMeasured, ContrastMeasured,
    SwatchOut, PaletteColorOut, AssetEngines, EvidenceRef
)
from ..engine.vision.palette import check_palette, region_bbox
from ..engine.vision.contrast import measure_region
from ..engine.vision.regions import detect_text_regions

MAGIC_BYTES = {
    "png": b"\x89PNG",
    "jpeg": b"\xff\xd8\xff",
    "webp_prefix": b"RIFF",
    "webp_sub": b"WEBP"
}

def validate_image_file(data: bytes) -> str:
    """Verifies file headers against supported image formats without trusting content-type."""
    if len(data) > settings.ASSET_MAX_MB * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail={"error": {"code": "FILE_TOO_LARGE", "message": f"Image exceeds maximum size of {settings.ASSET_MAX_MB}MB", "details": {}}}
        )

    if data.startswith(MAGIC_BYTES["png"]):
        return "image/png"
    if data.startswith(MAGIC_BYTES["jpeg"]):
        return "image/jpeg"
    if data.startswith(MAGIC_BYTES["webp_prefix"]) and MAGIC_BYTES["webp_sub"] in data[:16]:
        return "image/webp"

    raise HTTPException(
        status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
        detail={"error": {"code": "UNSUPPORTED_FILE_TYPE", "message": "Only PNG, JPEG, and WEBP image assets are accepted", "details": {}}}
    )

def normalize_image(data: bytes, mime: str) -> Tuple[bytes, Image.Image, int, int]:
    """
    Strips EXIF metadata, flattens alpha onto white background,
    and downscales longest dimension to <= 2000px.
    """
    try:
        Image.MAX_IMAGE_PIXELS = settings.ASSET_MAX_PIXELS
        img_raw = Image.open(io.BytesIO(data))
        img_raw.verify()

        # Reopen after verify
        img = Image.open(io.BytesIO(data))
        if getattr(img, "n_frames", 1) > 1:
            raise ValueError("Animated images are not supported")

        img = ImageOps.exif_transpose(img)

        # Flatten transparency
        if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
            bg = Image.new("RGB", img.size, (255, 255, 255))
            if img.mode != "RGBA":
                img = img.convert("RGBA")
            bg.paste(img, mask=img.split()[-1])
            img = bg
        else:
            img = img.convert("RGB")

        # Downscale if larger than 2000px
        max_side = 2000
        if max(img.width, img.height) > max_side:
            img.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)

        buf = io.BytesIO()
        if mime == "image/png":
            img.save(buf, format="PNG", optimize=True)
        else:
            img.save(buf, format="JPEG", quality=90, optimize=True)

        return buf.getvalue(), img, img.width, img.height

    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": {"code": "ASSET_INVALID_IMAGE", "message": f"Corrupt or invalid image: {exc}", "details": {}}}
        )

def process_and_save_asset(
    db: Session,
    submission_id: int,
    filename: str,
    raw_bytes: bytes,
    user: User
) -> CreativeAsset:
    """
    Full pipeline: validate -> normalize -> run checks -> persist -> return asset entity.
    """
    # Check asset count limit
    active_count = db.query(CreativeAsset).filter(
        CreativeAsset.submission_id == submission_id,
        CreativeAsset.active == True
    ).count()
    if active_count >= settings.ASSET_MAX_ACTIVE_PER_SUBMISSION:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": {"code": "ASSET_LIMIT_REACHED", "message": f"Maximum {settings.ASSET_MAX_ACTIVE_PER_SUBMISSION} active assets allowed per submission", "details": {}}}
        )

    mime = validate_image_file(raw_bytes)
    norm_bytes, img, width, height = normalize_image(raw_bytes, mime)
    sha256_hash = hashlib.sha256(norm_bytes).hexdigest()

    # Load brand palette from VIS-01 or defaults
    vis_rule = db.query(Rule).filter(Rule.id == "VIS-01").first()
    palette = []
    if vis_rule and vis_rule.pattern:
        palette = vis_rule.pattern.get("colors", [])
    if not palette:
        palette = [
            {"name": "Lumora Amber", "hex": "#F2A93B", "role": "primary"},
            {"name": "Midnight Navy", "hex": "#14213D", "role": "secondary"},
            {"name": "Warm White", "hex": "#FAF7F2", "role": "neutral"},
            {"name": "Soft Teal", "hex": "#2A9D8F", "role": "accent"}
        ]

    # 1. Palette check
    swatches, flagged_colors, idx_map = check_palette(
        img=img,
        palette=palette,
        max_de=settings.PALETTE_MAX_DELTA_E,
        min_share=settings.PALETTE_MIN_SHARE
    )

    # 2. Text region detection and contrast check
    regions, detector_type, contrast_reason = detect_text_regions(norm_bytes, sha256_hash)
    contrast_status = "ran" if detector_type in ("gemini", "mock") and regions else "unavailable"

    asset = CreativeAsset(
        submission_id=submission_id,
        filename=filename,
        mime=mime,
        width=width,
        height=height,
        size_bytes=len(norm_bytes),
        sha256=sha256_hash,
        data=norm_bytes,
        active=True,
        engines={
            "palette": "ran",
            "contrast": contrast_status,
            "contrast_reason": contrast_reason,
            "text_detector": detector_type
        },
        analysis={
            "dominant_colors": [s.model_dump() for s in swatches],
            "brand_palette": palette
        },
        uploaded_by=user.id,
        created_at=datetime.utcnow()
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)

    # Create AssetFindings
    issue_num = 1

    # Add palette findings
    for d, nearest, de in flagged_colors:
        bbox = region_bbox(idx_map, d.index)
        severity = "high" if (d.share >= 0.30 and de >= 40.0) else "medium"
        finding = AssetFinding(
            asset_id=asset.id,
            submission_id=submission_id,
            issue_id=f"V-{issue_num}",
            check_type="palette",
            category="visual",
            severity=severity,
            bbox_x=bbox.x,
            bbox_y=bbox.y,
            bbox_w=bbox.w,
            bbox_h=bbox.h,
            measured={
                "kind": "palette",
                "found_hex": d.hex,
                "found_share": round(d.share, 4),
                "nearest_hex": nearest["hex"],
                "nearest_name": nearest["name"],
                "delta_e": round(de, 1),
                "max_delta_e": settings.PALETTE_MAX_DELTA_E
            },
            explanation=f"About {int(d.share * 100)}% of this image uses {d.hex}, which is {de:.1f} ΔE away from the nearest approved color ({nearest['name']} {nearest['hex']}). Approved limit is {settings.PALETTE_MAX_DELTA_E}.",
            evidence_id="VIS-01",
            evidence_kind="rule",
            suggested_correction=f"Use {nearest['name']} ({nearest['hex']}) instead of {d.hex}",
            verification_status="style_issue",
            source_engine="vision",
            resolution="open"
        )
        db.add(finding)
        issue_num += 1

    # Add contrast findings
    if regions:
        for reg in regions:
            meas = measure_region(img, reg.box, settings.WCAG_MIN_RATIO)
            if meas and meas["ratio"] < settings.WCAG_MIN_RATIO:
                severity = "high" if meas["ratio"] < 3.0 else "medium"
                verif_status = "needs_human_verification" if meas["busy"] else "confirmed_contradiction"
                finding = AssetFinding(
                    asset_id=asset.id,
                    submission_id=submission_id,
                    issue_id=f"V-{issue_num}",
                    check_type="contrast",
                    category="accessibility",
                    severity=severity,
                    bbox_x=reg.box.x,
                    bbox_y=reg.box.y,
                    bbox_w=reg.box.w,
                    bbox_h=reg.box.h,
                    measured={
                        "kind": "contrast",
                        "foreground_hex": meas["fg"],
                        "background_hex": meas["bg"],
                        "ratio": meas["ratio"],
                        "required_ratio": settings.WCAG_MIN_RATIO,
                        "worst_case_ratio": meas["worst"],
                        "busy_background": meas["busy"],
                        "text_sample": reg.text
                    },
                    explanation=f"Text '{reg.text}' has a contrast ratio of {meas['ratio']}:1 against its background. WCAG AA requires at least {settings.WCAG_MIN_RATIO}:1.",
                    evidence_id="ACC-01",
                    evidence_kind="rule",
                    suggested_correction="Use Midnight Navy #14213D for this text (contrast 11.8:1)",
                    verification_status=verif_status,
                    source_engine="vision",
                    resolution="open"
                )
                db.add(finding)
                issue_num += 1

    db.commit()
    db.refresh(asset)
    return asset

def serialize_asset(asset: CreativeAsset) -> AssetOut:
    """Serializes CreativeAsset ORM model to Contract v3 AssetOut schema."""
    findings_out = []
    summary = {"critical": 0, "high": 0, "medium": 0, "low": 0, "total": 0}

    for f in asset.findings:
        meas_data = f.measured
        if meas_data.get("kind") == "palette":
            measured_obj = PaletteMeasured(**meas_data)
        else:
            measured_obj = ContrastMeasured(**meas_data)

        finding_out = AssetFindingOut(
            id=f.id,
            issue_id=f.issue_id,
            asset_id=f.asset_id,
            check_type=f.check_type,  # type: ignore
            category=f.category,      # type: ignore
            severity=f.severity,      # type: ignore
            bbox=BBox(x=f.bbox_x, y=f.bbox_y, w=f.bbox_w, h=f.bbox_h),
            measured=measured_obj,
            explanation=f.explanation,
            evidence=EvidenceRef(id=f.evidence_id, kind="rule", label="Visual rule"),
            suggested_correction=f.suggested_correction,
            verification_status=f.verification_status,  # type: ignore
            source_engine="vision",
            resolution=f.resolution,  # type: ignore
            resolution_reason=f.resolution_reason
        )
        findings_out.append(finding_out)
        if f.resolution == "open":
            summary[f.severity] = summary.get(f.severity, 0) + 1
            summary["total"] += 1

    analysis = asset.analysis or {}
    dom_swatches = [SwatchOut(**s) for s in analysis.get("dominant_colors", [])]
    brand_palette = [PaletteColorOut(**c) for c in analysis.get("brand_palette", [])]

    engines_data = asset.engines or {}
    engines_obj = AssetEngines(
        palette=engines_data.get("palette", "ran"),
        contrast=engines_data.get("contrast", "ran"),
        contrast_reason=engines_data.get("contrast_reason"),
        text_detector=engines_data.get("text_detector", "mock")
    )

    return AssetOut(
        id=asset.id,
        submission_id=asset.submission_id,
        version_id=asset.version_id,
        filename=asset.filename,
        mime=asset.mime,
        width=asset.width,
        height=asset.height,
        size_bytes=asset.size_bytes,
        active=asset.active,
        created_at=asset.created_at,
        engines=engines_obj,
        dominant_colors=dom_swatches,
        brand_palette=brand_palette,
        summary=summary,
        findings=findings_out
    )

