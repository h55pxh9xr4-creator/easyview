from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from pathlib import Path
import uuid, shutil
from database import get_db
from models import DataRequest, RequestFile, RequestComment, RequestHistory

router = APIRouter()

MEDIA_DIR = Path(__file__).parent.parent / "media" / "requests"


# ── Schemas ──────────────────────────────────────────────────
class RequestCreate(BaseModel):
    title:       str
    entity:      str
    assignee:    str
    requester:   str
    status:      str = "Draft"
    priority:    str = "보통"
    due_date:    str = ""
    description: str = ""

class StatusUpdate(BaseModel):
    status: str

class CommentCreate(BaseModel):
    author:   str
    role:     str = "viewer"
    text:     str
    file_ref: Optional[str] = None

class RequestUpdate(BaseModel):
    title:       Optional[str] = None
    entity:      Optional[str] = None
    assignee:    Optional[str] = None
    requester:   Optional[str] = None
    status:      Optional[str] = None
    priority:    Optional[str] = None
    due_date:    Optional[str] = None
    description: Optional[str] = None


# ── Helpers ──────────────────────────────────────────────────
def _fmt(r: DataRequest):
    return {
        "id":          r.id,
        "reqCode":     r.req_code,
        "title":       r.title,
        "entity":      r.entity   or "",
        "assignee":    r.assignee or "",
        "requester":   r.requester or "",
        "status":      r.status   or "Draft",
        "priority":    r.priority or "보통",
        "dueDate":     r.due_date or "—",
        "createdDate": r.created_at.strftime("%Y-%m-%d") if r.created_at else "",
        "description": r.description or "",
    }

def _fmt_comment(c: RequestComment):
    return {
        "id":        c.id,
        "requestId": c.request_id,
        "author":    c.author,
        "role":      c.role or "viewer",
        "text":      c.text,
        "fileRef":   c.file_ref,
        "ts":        c.created_at.strftime("%Y-%m-%d %H:%M:%S") if c.created_at else "",
    }

def _fmt_file(rf: RequestFile):
    return {
        "id":           rf.id,
        "requestId":    rf.request_id,
        "filename":     rf.filename,
        "originalName": rf.original_name,
        "uploader":     rf.uploader or "",
        "size":         rf.size or 0,
        "uploadedAt":   rf.uploaded_at.strftime("%Y-%m-%d %H:%M:%S") if rf.uploaded_at else "",
        "url":          f"/media/requests/{rf.request_id}/{rf.filename}",
    }

def _fmt_history(h: RequestHistory):
    return {
        "id":        h.id,
        "requestId": h.request_id,
        "actor":     h.actor or "—",
        "eventType": h.event_type,
        "detail":    h.detail or "",
        "ts":        h.created_at.strftime("%Y-%m-%d %H:%M:%S") if h.created_at else "",
    }

def _next_code(db: Session) -> str:
    count = db.query(func.count(DataRequest.id)).scalar() or 0
    return f"REQ-{str(count + 1).zfill(3)}"


# ── Endpoints ────────────────────────────────────────────────
@router.get("")
def list_requests(db: Session = Depends(get_db)):
    rows = db.query(DataRequest).order_by(DataRequest.id.desc()).all()
    return [_fmt(r) for r in rows]


@router.post("", status_code=201)
def create_requests(items: List[RequestCreate], db: Session = Depends(get_db)):
    created = []
    for item in items:
        code = _next_code(db)
        row  = DataRequest(req_code=code, **item.model_dump())
        db.add(row)
        db.flush()
        created.append(row.id)
    db.commit()
    return {"ids": created}


@router.patch("/{req_id}")
def update_request(req_id: int, body: RequestUpdate, db: Session = Depends(get_db)):
    row = db.query(DataRequest).filter(DataRequest.id == req_id).first()
    if not row:
        raise HTTPException(404, "Not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(row, field, value)
    db.commit()
    db.refresh(row)
    return _fmt(row)


@router.patch("/{req_id}/status")
def update_status(req_id: int, body: StatusUpdate, db: Session = Depends(get_db)):
    row = db.query(DataRequest).filter(DataRequest.id == req_id).first()
    if not row:
        raise HTTPException(404, "Not found")
    row.status = body.status
    db.commit()
    return {"ok": True}


@router.delete("/{req_id}")
def delete_request(req_id: int, db: Session = Depends(get_db)):
    row = db.query(DataRequest).filter(DataRequest.id == req_id).first()
    if not row:
        raise HTTPException(404, "Not found")
    req_dir = MEDIA_DIR / str(req_id)
    if req_dir.exists():
        shutil.rmtree(req_dir, ignore_errors=True)
    db.query(RequestFile).filter(RequestFile.request_id == req_id).delete()
    db.delete(row)
    db.commit()
    return {"ok": True}


# ── Comments ─────────────────────────────────────────────────
@router.get("/{req_id}/comments")
def list_comments(req_id: int, db: Session = Depends(get_db)):
    rows = db.query(RequestComment).filter(RequestComment.request_id == req_id).order_by(RequestComment.created_at).all()
    return [_fmt_comment(c) for c in rows]

@router.post("/{req_id}/comments", status_code=201)
def create_comment(req_id: int, body: CommentCreate, db: Session = Depends(get_db)):
    row = RequestComment(request_id=req_id, **body.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return _fmt_comment(row)

@router.delete("/{req_id}/comments/{comment_id}")
def delete_comment(req_id: int, comment_id: int, db: Session = Depends(get_db)):
    c = db.query(RequestComment).filter(RequestComment.id == comment_id, RequestComment.request_id == req_id).first()
    if not c:
        raise HTTPException(404, "Not found")
    db.delete(c)
    db.commit()
    return {"ok": True}


# ── History ──────────────────────────────────────────────────
@router.get("/{req_id}/history")
def get_history(req_id: int, db: Session = Depends(get_db)):
    rows = db.query(RequestHistory).filter(RequestHistory.request_id == req_id).order_by(RequestHistory.created_at).all()
    return [_fmt_history(r) for r in rows]


# ── Files ────────────────────────────────────────────────────
@router.get("/{req_id}/files")
def list_files(req_id: int, db: Session = Depends(get_db)):
    files = (
        db.query(RequestFile)
        .filter(RequestFile.request_id == req_id)
        .order_by(RequestFile.uploaded_at.desc())
        .all()
    )
    return [_fmt_file(f) for f in files]


@router.post("/{req_id}/files", status_code=201)
async def upload_file(
    req_id:   int,
    uploader: str        = Form(""),
    file:     UploadFile = File(...),
    db:       Session    = Depends(get_db),
):
    suffix  = Path(file.filename).suffix
    stored  = f"{uuid.uuid4().hex}{suffix}"
    dest_dir = MEDIA_DIR / str(req_id)
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / stored

    with dest.open("wb") as out:
        shutil.copyfileobj(file.file, out)

    rf = RequestFile(
        request_id=req_id,
        filename=stored,
        original_name=file.filename,
        uploader=uploader,
        size=dest.stat().st_size,
    )
    db.add(rf)
    db.commit()
    db.refresh(rf)
    return _fmt_file(rf)


@router.get("/{req_id}/files/{file_id}/download")
def download_file(req_id: int, file_id: int, db: Session = Depends(get_db)):
    rf = (
        db.query(RequestFile)
        .filter(RequestFile.id == file_id, RequestFile.request_id == req_id)
        .first()
    )
    if not rf:
        raise HTTPException(404, "Not found")
    path = MEDIA_DIR / str(req_id) / rf.filename
    if not path.exists():
        raise HTTPException(404, "File not found on disk")
    return FileResponse(path=str(path), filename=rf.original_name, media_type="application/octet-stream")


@router.delete("/{req_id}/files/{file_id}")
def delete_file(req_id: int, file_id: int, actor: str = "", db: Session = Depends(get_db)):
    rf = (
        db.query(RequestFile)
        .filter(RequestFile.id == file_id, RequestFile.request_id == req_id)
        .first()
    )
    if not rf:
        raise HTTPException(404, "Not found")
    log = RequestHistory(
        request_id=req_id,
        actor=actor,
        event_type="delete_file",
        detail=f"파일 삭제: {rf.original_name}",
    )
    db.add(log)
    try:
        (MEDIA_DIR / str(req_id) / rf.filename).unlink(missing_ok=True)
    except Exception:
        pass
    db.delete(rf)
    db.commit()
    return {"ok": True}
