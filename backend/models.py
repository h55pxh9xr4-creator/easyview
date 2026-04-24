from sqlalchemy import Column, Integer, Float, String, Date, Boolean, Index, DateTime, Text, ForeignKey
from datetime import datetime
from database import Base


class TBAccount(Base):
    __tablename__ = "tb_account"

    account_code = Column(String, primary_key=True)
    account_name = Column(String)        # 계정과목 (회사계정)
    account_name_1 = Column(String)      # 1차 번역
    disclosure_acct = Column(String)     # 공시용계정
    mgmt_acct = Column(String)           # 관리계정
    sum_acct = Column(String)            # 합산계정 (유동자산/비유동자산/유동부채/비유동부채/자본)
    category = Column(String)            # 분류 (자산/부채/자본)
    section = Column(String)             # 구분 (BS)
    opening_balance = Column(Float)      # 기초잔액 (원본)
    # 부호 적용 기초: 자산 +, 부채/자본 -
    opening_signed = Column(Float)       # 기초(부호)


class JE(Base):
    __tablename__ = "je"

    record_id = Column(Integer, primary_key=True)
    date = Column(Date)
    year_month = Column(String)          # 'YYYY-MM' 인덱스용
    voucher_no = Column(String)          # 전표식별번호
    dr_cr = Column(String)               # 차대 (차변/대변)
    amount = Column(Float)               # 금액 (원본)
    signed_amount = Column(Float)        # 금액(부호): 차변 +금액, 대변 -금액
    counterparty = Column(String)        # 거래처(번역)
    counterparty_raw = Column(String)    # 거래처(원문)
    description = Column(String)         # 적요(번역)
    description_raw = Column(String)     # 적요(원문)
    account_code = Column(String)        # 계정코드
    account_name = Column(String)        # 계정과목
    disclosure_acct = Column(String)     # 공시용계정
    mgmt_acct = Column(String)           # 관리계정
    sum_acct = Column(String)            # 합산계정
    category = Column(String)            # 분류 (자산/부채/비용/수익/손익대체)
    section = Column(String)             # 구분 (BS/PL/IT)
    is_weekend = Column(Boolean)         # 주말 여부
    is_cash = Column(Boolean)            # 현금계정 여부 (공시용계정 LIKE '%현금%')


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
    reply       = Column(Text,    nullable=True)     # 관리자 답변
    reply_at    = Column(DateTime, nullable=True)    # 답변 일시
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


# 인덱스 정의
Index("idx_je_yearmonth", JE.year_month)
Index("idx_je_section", JE.section)
Index("idx_je_disclosure", JE.disclosure_acct)
Index("idx_je_date", JE.date)
Index("idx_je_voucher", JE.voucher_no)
Index("idx_je_category", JE.category)
