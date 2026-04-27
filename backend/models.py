from sqlalchemy import Column, Integer, Float, String, Date, Boolean, DateTime, Text, ForeignKey
from datetime import datetime
from database import Base


class TBData(Base):
    """TB(시산표) 물리 테이블 — report_id 기준으로 리포트별 분리."""
    __tablename__ = "tb_data"

    id = Column(Integer, primary_key=True, autoincrement=True)
    report_id = Column(Integer, index=True)
    account_code = Column(String)
    account_name = Column(String)
    account_name_1 = Column(String)
    disclosure_acct = Column(String)
    mgmt_acct = Column(String)
    sum_acct = Column(String)
    category = Column(String)
    section = Column(String)
    opening_balance = Column(Float)
    opening_signed = Column(Float)


class JEData(Base):
    """JE(전표) 물리 테이블 — report_id 기준으로 리포트별 분리."""
    __tablename__ = "je_data"

    id = Column(Integer, primary_key=True, autoincrement=True)
    report_id = Column(Integer, index=True)
    record_id = Column(Integer)
    date = Column(Date)
    year_month = Column(String)
    voucher_no = Column(String)
    dr_cr = Column(String)
    amount = Column(Float)
    signed_amount = Column(Float)
    counterparty = Column(String)
    counterparty_raw = Column(String)
    description = Column(String)
    description_raw = Column(String)
    account_code = Column(String)
    account_name = Column(String)
    disclosure_acct = Column(String)
    mgmt_acct = Column(String)
    sum_acct = Column(String)
    category = Column(String)
    section = Column(String)
    is_weekend = Column(Boolean)
    is_cash = Column(Boolean)


class Inquiry(Base):
    __tablename__ = "inquiry"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    category    = Column(String,  nullable=False, default="기타 문의")  # 조회 오류 | 데이터 오류 | 기타 문의
    title       = Column(String,  nullable=False)
    content     = Column(Text,    nullable=False)
    author      = Column(String,  nullable=False)
    corporation = Column(String,  nullable=True)     # 법인명
    is_secret   = Column(Boolean, default=False)     # 비밀글 여부
    status      = Column(String,  default="답변대기") # 답변대기 | 답변완료
    reply       = Column(Text,    nullable=True)     # (레거시) 최신 답변 캐시 — 실제 리스트는 InquiryReply
    reply_at    = Column(DateTime, nullable=True)    # (레거시) 최신 답변 일시 캐시
    created_at  = Column(DateTime, default=datetime.now)


class InquiryReply(Base):
    """문의게시판 답변/댓글 — 하나의 문의에 여러 건 누적."""
    __tablename__ = "inquiry_reply"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    inquiry_id  = Column(Integer, nullable=False, index=True)
    author      = Column(String,  nullable=False)
    content     = Column(Text,    nullable=False)
    created_at  = Column(DateTime, default=datetime.now)


class DataRequest(Base):
    __tablename__ = "data_request"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    req_code    = Column(String,  nullable=False)          # REQ-001
    title       = Column(String,  nullable=False)
    entity      = Column(String)
    assignee    = Column(String)                           # 쉼표 구분 이름
    requester   = Column(String)
    status      = Column(String,  default="초안")
    priority    = Column(String,  default="보통")
    due_date    = Column(String)
    description = Column(Text)
    created_at  = Column(DateTime, default=datetime.now)


class RequestFile(Base):
    __tablename__ = "request_file"

    id            = Column(Integer, primary_key=True, autoincrement=True)
    request_id    = Column(Integer, ForeignKey("data_request.id", ondelete="CASCADE"), nullable=False)
    filename      = Column(String,  nullable=False)        # 저장 파일명 (uuid.ext)
    original_name = Column(String,  nullable=False)        # 원본 파일명
    uploader      = Column(String)
    size          = Column(Integer)
    uploaded_at   = Column(DateTime, default=datetime.now)


class RequestComment(Base):
    __tablename__ = "request_comment"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    request_id = Column(Integer, ForeignKey("data_request.id", ondelete="CASCADE"), nullable=False)
    author     = Column(String, nullable=False)
    role       = Column(String, default="viewer")   # admin | viewer | uploader | viewer_uploader
    text       = Column(Text,   nullable=False)
    file_ref   = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.now)


class RequestHistory(Base):
    __tablename__ = "request_history"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    request_id = Column(Integer, ForeignKey("data_request.id", ondelete="CASCADE"), nullable=False)
    actor      = Column(String)
    event_type = Column(String, nullable=False)  # delete_file
    detail     = Column(Text)
    created_at = Column(DateTime, default=datetime.now)

