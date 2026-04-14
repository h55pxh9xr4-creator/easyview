from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from database import get_db
from models import Inquiry

router = APIRouter()


# ── Schemas ──────────────────────────────────────────────────
CATEGORIES = ["조회 오류", "데이터 오류", "기타 문의"]

class InquiryCreate(BaseModel):
    category:  str = "기타 문의"
    title:     str
    content:   str
    author:    str
    is_secret: bool = False

class ReplyCreate(BaseModel):
    reply: str


# ── Endpoints ────────────────────────────────────────────────
@router.get("")
def list_inquiries(db: Session = Depends(get_db)):
    rows = db.query(Inquiry).order_by(Inquiry.id.desc()).all()
    return [
        {
            "id":         r.id,
            "category":   r.category or "기타 문의",
            "title":      r.title,
            "author":     r.author,
            "is_secret":  r.is_secret,
            "status":     r.status,
            "created_at": r.created_at.strftime("%Y-%m-%d %H:%M") if r.created_at else "",
        }
        for r in rows
    ]


@router.post("", status_code=201)
def create_inquiry(body: InquiryCreate, db: Session = Depends(get_db)):
    row = Inquiry(**body.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"id": row.id}


@router.get("/{inquiry_id}")
def get_inquiry(inquiry_id: int, db: Session = Depends(get_db)):
    row = db.query(Inquiry).filter(Inquiry.id == inquiry_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    return {
        "id":         row.id,
        "category":   row.category or "기타 문의",
        "title":      row.title,
        "content":    row.content,
        "author":     row.author,
        "is_secret":  row.is_secret,
        "status":     row.status,
        "reply":      row.reply,
        "reply_at":   row.reply_at.strftime("%Y-%m-%d %H:%M") if row.reply_at else None,
        "created_at": row.created_at.strftime("%Y-%m-%d %H:%M") if row.created_at else "",
    }


@router.post("/{inquiry_id}/reply")
def reply_inquiry(inquiry_id: int, body: ReplyCreate, db: Session = Depends(get_db)):
    row = db.query(Inquiry).filter(Inquiry.id == inquiry_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    row.reply    = body.reply
    row.reply_at = datetime.now()
    row.status   = "답변완료"
    db.commit()
    return {"ok": True}


@router.delete("/{inquiry_id}")
def delete_inquiry(inquiry_id: int, db: Session = Depends(get_db)):
    row = db.query(Inquiry).filter(Inquiry.id == inquiry_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(row)
    db.commit()
    return {"ok": True}
