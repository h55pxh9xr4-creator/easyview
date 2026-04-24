import os
import json
import urllib.request
import urllib.error
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from database import get_db
from models import Inquiry, InquiryReply

router = APIRouter()

# ── Power Automate / Outlook 메일 알림 ───────────────────────
# Power Automate에서 "HTTP 요청이 수신되는 경우" 트리거로 Flow를 만들고 URL을 환경변수에 설정.
# Flow는 JSON payload를 받아 Outlook "메일 보내기(V2)" 액션으로 sou-jung.park@pwc.com에 발송.
INQUIRY_NOTIFY_WEBHOOK_URL = os.getenv("INQUIRY_NOTIFY_WEBHOOK_URL", "").strip()
INQUIRY_NOTIFY_TO = os.getenv("INQUIRY_NOTIFY_TO", "sou-jung.park@pwc.com")

def _send_reply_notification(inquiry: dict, reply: dict) -> None:
    """댓글 등록 시 Power Automate webhook으로 메일 발송 요청. 실패해도 무시."""
    if not INQUIRY_NOTIFY_WEBHOOK_URL:
        return  # webhook 미설정이면 skip
    payload = {
        "to": INQUIRY_NOTIFY_TO,
        "subject": f"[EasyView 문의게시판] '{inquiry.get('title','')}'에 새 댓글이 등록되었습니다.",
        "inquiry_id": inquiry.get("id"),
        "inquiry_title": inquiry.get("title"),
        "inquiry_author": inquiry.get("author"),
        "inquiry_category": inquiry.get("category"),
        "reply_author": reply.get("author"),
        "reply_content": reply.get("content"),
        "reply_created_at": reply.get("created_at"),
    }
    try:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        req = urllib.request.Request(
            INQUIRY_NOTIFY_WEBHOOK_URL,
            data=data,
            headers={"Content-Type": "application/json; charset=utf-8"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=6) as resp:
            resp.read()
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, Exception) as e:
        print(f"[inquiry notify] webhook failed: {e}")


# ── Schemas ──────────────────────────────────────────────────
CATEGORIES = ["Comment", "조회 오류", "데이터 오류", "기타 문의"]

class InquiryCreate(BaseModel):
    category:    str = "기타 문의"
    title:       str
    content:     str
    author:      str
    corporation: Optional[str] = None
    is_secret:   bool = False

class InquiryUpdate(BaseModel):
    category:    Optional[str] = None
    title:       Optional[str] = None
    content:     Optional[str] = None
    corporation: Optional[str] = None
    is_secret:   Optional[bool] = None

class ReplyCreate(BaseModel):
    reply: str
    author: Optional[str] = None


# ── Endpoints ────────────────────────────────────────────────
@router.get("")
def list_inquiries(db: Session = Depends(get_db)):
    rows = db.query(Inquiry).order_by(Inquiry.id.desc()).all()
    return [
        {
            "id":          r.id,
            "category":    r.category or "기타 문의",
            "title":       r.title,
            "author":      r.author,
            "corporation": r.corporation or "",
            "is_secret":   r.is_secret,
            "status":      r.status,
            "created_at":  r.created_at.strftime("%Y-%m-%d %H:%M") if r.created_at else "",
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
    replies = (
        db.query(InquiryReply)
        .filter(InquiryReply.inquiry_id == inquiry_id)
        .order_by(InquiryReply.created_at.asc(), InquiryReply.id.asc())
        .all()
    )
    replies_out = [
        {
            "id": r.id,
            "author": r.author,
            "content": r.content,
            "created_at": r.created_at.strftime("%Y-%m-%d %H:%M") if r.created_at else "",
        }
        for r in replies
    ]
    # 레거시 호환: 첫 답변(가장 오래된 답변)을 reply로 노출
    legacy_first = replies_out[0] if replies_out else None
    return {
        "id":          row.id,
        "category":    row.category or "기타 문의",
        "title":       row.title,
        "content":     row.content,
        "author":      row.author,
        "corporation": row.corporation or "",
        "is_secret":   row.is_secret,
        "status":      row.status,
        "reply":       legacy_first["content"] if legacy_first else row.reply,
        "reply_at":    legacy_first["created_at"] if legacy_first else (row.reply_at.strftime("%Y-%m-%d %H:%M") if row.reply_at else None),
        "replies":     replies_out,
        "created_at":  row.created_at.strftime("%Y-%m-%d %H:%M") if row.created_at else "",
    }


@router.patch("/{inquiry_id}")
def update_inquiry(inquiry_id: int, body: InquiryUpdate, db: Session = Depends(get_db)):
    row = db.query(Inquiry).filter(Inquiry.id == inquiry_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    if body.category    is not None: row.category    = body.category
    if body.title       is not None: row.title       = body.title
    if body.content     is not None: row.content     = body.content
    if body.corporation is not None: row.corporation = body.corporation
    if body.is_secret   is not None: row.is_secret   = body.is_secret
    db.commit()
    return {"ok": True}


@router.post("/{inquiry_id}/reply")
def reply_inquiry(inquiry_id: int, body: ReplyCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    row = db.query(Inquiry).filter(Inquiry.id == inquiry_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    new_reply = InquiryReply(
        inquiry_id=inquiry_id,
        author=body.author or "관리자",
        content=body.reply,
    )
    db.add(new_reply)
    # 레거시 캐시 컬럼도 최신 값으로 업데이트
    row.reply    = body.reply
    row.reply_at = datetime.now()
    row.status   = "답변완료"
    db.commit()
    db.refresh(new_reply)

    reply_dict = {
        "id": new_reply.id,
        "author": new_reply.author,
        "content": new_reply.content,
        "created_at": new_reply.created_at.strftime("%Y-%m-%d %H:%M") if new_reply.created_at else "",
    }
    inquiry_dict = {
        "id": row.id,
        "title": row.title,
        "author": row.author,
        "category": row.category,
    }
    # Power Automate webhook 비동기 호출 (실패해도 응답은 성공)
    background_tasks.add_task(_send_reply_notification, inquiry_dict, reply_dict)

    return {"ok": True, "reply": reply_dict}


@router.delete("/{inquiry_id}/reply/{reply_id}")
def delete_reply(inquiry_id: int, reply_id: int, db: Session = Depends(get_db)):
    r = db.query(InquiryReply).filter(
        InquiryReply.id == reply_id, InquiryReply.inquiry_id == inquiry_id
    ).first()
    if not r:
        raise HTTPException(status_code=404, detail="Reply not found")
    db.delete(r)
    db.commit()
    # 남은 답변 기준으로 레거시 캐시/상태 재계산
    latest = (
        db.query(InquiryReply)
        .filter(InquiryReply.inquiry_id == inquiry_id)
        .order_by(InquiryReply.created_at.desc(), InquiryReply.id.desc())
        .first()
    )
    inq = db.query(Inquiry).filter(Inquiry.id == inquiry_id).first()
    if inq:
        if latest:
            inq.reply = latest.content
            inq.reply_at = latest.created_at
            inq.status = "답변완료"
        else:
            inq.reply = None
            inq.reply_at = None
            inq.status = "답변대기"
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
