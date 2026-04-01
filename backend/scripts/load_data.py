"""
Excel 데이터 → SQLite 적재 스크립트
실행: python scripts/load_data.py
"""
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

import pandas as pd
from sqlalchemy import text
from database import engine, Base
from models import TBAccount, JE

TB_PATH = r"C:\Users\sryu027\Desktop\교육\sample_data\ABC_TB.xlsx"
JE_PATH = r"C:\Users\sryu027\Desktop\교육\sample_data\ABC_JE v2.xlsx"


def load_tb(session):
    print("TB 데이터 로딩 중...")
    df = pd.read_excel(TB_PATH)
    df.columns = ["account_name_1", "account_name", "account_code",
                  "disclosure_acct", "mgmt_acct", "section", "category",
                  "sum_acct", "company_acct", "opening_balance"]

    records = []
    for _, row in df.iterrows():
        # 부호 적용: 자산 +, 부채/자본 -
        sign = 1 if row["category"] == "자산" else -1
        records.append(TBAccount(
            account_code=str(int(row["account_code"])),
            account_name=row["account_name"],
            account_name_1=row["account_name_1"],
            disclosure_acct=row["disclosure_acct"],
            mgmt_acct=row["mgmt_acct"],
            sum_acct=row["sum_acct"],
            category=row["category"],
            section=row["section"],
            opening_balance=float(row["opening_balance"] or 0),
            opening_signed=float(row["opening_balance"] or 0) * sign,
        ))

    session.bulk_save_objects(records)
    session.commit()
    print(f"  TB: {len(records)}개 계정 적재 완료")


def load_je(conn):
    print("JE 데이터 로딩 중... (134,784행, 시간이 걸릴 수 있습니다)")
    df = pd.read_excel(JE_PATH)
    df.columns = ["date", "voucher_no", "dr_cr", "amount",
                  "counterparty_raw", "counterparty", "description_raw", "description",
                  "account_code", "company_acct", "account_name_1", "account_name",
                  "mgmt_acct", "disclosure_acct", "sum_acct", "category", "section", "record_id"]

    df["date"] = pd.to_datetime(df["date"]).dt.date
    df["year_month"] = df["date"].astype(str).str[:7]
    df["signed_amount"] = df.apply(
        lambda r: r["amount"] if r["dr_cr"] == "차변" else -r["amount"], axis=1
    )
    df["is_weekend"] = pd.to_datetime(df["date"]).dt.dayofweek >= 5
    df["is_cash"] = df["disclosure_acct"].str.contains("현금", na=False)
    df["account_code"] = df["account_code"].astype(str)

    out = df[["record_id", "date", "year_month", "voucher_no", "dr_cr", "amount",
              "signed_amount", "counterparty", "counterparty_raw", "description",
              "description_raw", "account_code", "account_name", "disclosure_acct",
              "mgmt_acct", "sum_acct", "category", "section", "is_weekend", "is_cash"]]

    CHUNK = 10000
    total = len(out)
    for i in range(0, total, CHUNK):
        out.iloc[i:i + CHUNK].to_sql("je", conn, if_exists="append", index=False)
        print(f"  JE: {min(i + CHUNK, total):,}/{total:,} 적재 완료")

    print(f"  JE: 총 {total:,}개 전표 적재 완료")


def main():
    print("=== EasyView DB 초기화 ===")
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    print("테이블 생성 완료")

    from sqlalchemy.orm import Session
    with Session(engine) as session:
        load_tb(session)

    # JE는 pandas to_sql로 직접 적재
    with engine.connect() as conn:
        load_je(conn)

    print("\n✓ 완료! data/easyview.db 생성됨")


if __name__ == "__main__":
    main()
