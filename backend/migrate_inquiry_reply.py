"""inquiry_reply 테이블 생성 + 기존 inquiry.reply 데이터를 InquiryReply 행으로 이관.

- 재실행 안전: 이미 해당 inquiry에 대한 답변 행이 있으면 건너뜀.
- 실행: python migrate_inquiry_reply.py  (backend 디렉터리에서)
"""
from database import engine, Base, SessionLocal
from models import Inquiry, InquiryReply

# 1) 테이블 생성 (없으면)
Base.metadata.create_all(bind=engine)

# 2) 기존 inquiry.reply → InquiryReply로 이관
db = SessionLocal()
try:
    inquiries = db.query(Inquiry).filter(Inquiry.reply.isnot(None)).all()
    migrated = 0
    skipped = 0
    for inq in inquiries:
        exists = db.query(InquiryReply).filter(InquiryReply.inquiry_id == inq.id).count()
        if exists:
            skipped += 1
            continue
        reply_content = (inq.reply or "").strip()
        if not reply_content:
            continue
        new_reply = InquiryReply(
            inquiry_id=inq.id,
            author="관리자",
            content=reply_content,
            created_at=inq.reply_at,
        )
        db.add(new_reply)
        migrated += 1
    db.commit()
    print(f"[inquiry_reply 마이그레이션] migrated={migrated}, skipped(이미 존재)={skipped}")
finally:
    db.close()
