from sqlalchemy import Column, Integer, Float, String, Date, Boolean, Index
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


# 인덱스 정의
Index("idx_je_yearmonth", JE.year_month)
Index("idx_je_section", JE.section)
Index("idx_je_disclosure", JE.disclosure_acct)
Index("idx_je_date", JE.date)
Index("idx_je_voucher", JE.voucher_no)
Index("idx_je_category", JE.category)
