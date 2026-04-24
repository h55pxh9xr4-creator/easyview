"""청구 관리 (Billing) — 엑셀 Easy View 빌링현황.xlsm 미러 + 상태 관리."""
from sqlalchemy import Column, Integer, String, Text, Date, DateTime, Float, Boolean, Index
from sqlalchemy.sql import func
from database import Base


class BillingEntry(Base):
    """빌링 건 (대기중 + 완료 통합) — (mgmt_no, report_ym) 조합이 유니크."""
    __tablename__ = "billing_entry"
    __table_args__ = (
        Index("idx_billing_mgmt_ym", "mgmt_no", "report_ym"),
        Index("idx_billing_status", "status"),
        Index("idx_billing_completed", "is_completed"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    parent = Column(String, index=True)                # 모회사명
    subsidiary = Column(String)                         # 자회사명
    mgmt_no = Column(String, index=True)                # 관리번호
    assignee = Column(String)                           # 담당자
    report_ym = Column(String)                          # report 기준월 (예: "2026년 3월")
    delivery_ym = Column(String)                        # report 전달월
    billing_date = Column(Date)                         # 빌링 작업일자
    invoice_date = Column(Date)                         # 세금계산서 일자
    status = Column(String)                             # 빌링 여부 (빌링대기중/완료 등)
    deposit_date = Column(Date)                         # 입금 일자
    memo = Column(Text)                                 # 비고
    amount = Column(Float)                              # 법인별 계약 금액
    invoice_request_day = Column(String)                # 세금계산서 발행요청일
    invoice_manager = Column(String)                    # 세금계산서 담당자
    manager_email = Column(String)                      # 담당자 이메일
    manager_phone = Column(String)                      # 담당자 연락처
    is_completed = Column(Boolean, default=False, index=True)  # 완료리스트 여부
    transfer_at = Column(Date)                          # 이관일 (완료 기준)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class BillingMaster(Base):
    """계약 마스터 — 관리번호별 고정 정보."""
    __tablename__ = "billing_master"

    id = Column(Integer, primary_key=True, autoincrement=True)
    mgmt_no = Column(String, unique=True, index=True)
    company = Column(String)                            # 계약대상 회사
    parent = Column(String, index=True)                 # 모회사명
    amount = Column(Float)                              # 법인별 계약 금액
    invoice_request_day = Column(String)                # 세금계산서 발행요청일
    invoice_manager = Column(String)
    manager_email = Column(String)
    manager_phone = Column(String)


class BillingException(Base):
    """특이사항 법인 — 법인별 예외 메모."""
    __tablename__ = "billing_exception"

    id = Column(Integer, primary_key=True, autoincrement=True)
    no = Column(Integer)
    category = Column(String)                           # 구분 (비고 체크 / 빌링(결과물 무관) 등)
    parent = Column(String, index=True)
    note = Column(Text)
