"""
Excel 데이터 → SQLite 적재 스크립트
실행: python scripts/load_data.py [회사명]
  회사명: ABC (기본값), 가온미디어, 풀무원
예) python scripts/load_data.py 가온미디어
"""
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

import pandas as pd
from sqlalchemy import text
from database import engine, Base
from models import TBAccount, JE

SAMPLE_DIR = r"C:\Users\sryu027\Desktop\교육\sample_data"

COMPANIES = {
    "ABC":    ("ABC_TB.xlsx",             "ABC_JE v2.xlsx"),
    "가온미디어": ("가온미디어_일본_TB_3월_ v1.xlsx", "가온미디어_일본_JE_3월_v2.xlsx"),
    "풀무원":   ("풀무원식품 TB 3월 1.xlsx",    "풀무원식품 JE 3월 1.xlsx"),
}

# 컬럼명(한글) → 내부 필드명 매핑
TB_COLUMN_MAP = {
    "1차 번역":  "account_name_1",
    "계정과목":  "account_name",
    "계정코드":  "account_code",
    "공시용계정": "disclosure_acct",
    "관리계정":  "mgmt_acct",
    "구분":    "section",
    "분류":    "category",
    "합산계정":  "sum_acct",
    "회사계정":  "company_acct",
    "기초":    "opening_balance",
}

JE_COLUMN_MAP = {
    "일자":       "date",
    "전표식별번호":  "voucher_no",
    "차대":       "dr_cr",
    "금액":       "amount",
    "거래처":      "counterparty_raw",
    "거래처(번역)": "counterparty",
    "적요":       "description_raw",
    "적요(번역)":  "description",
    "계정코드":    "account_code",
    "회사계정":    "company_acct",
    "1차 번역":   "account_name_1",
    "계정과목":    "account_name",
    "관리계정":    "mgmt_acct",
    "공시용계정":  "disclosure_acct",
    "합산계정":    "sum_acct",
    "분류":       "category",
    "구분":       "section",
    "RecordID":   "record_id",
}

JE_OUTPUT_COLS = [
    "record_id", "date", "year_month", "voucher_no", "dr_cr", "amount",
    "signed_amount", "counterparty", "counterparty_raw", "description",
    "description_raw", "account_code", "account_name", "disclosure_acct",
    "mgmt_acct", "sum_acct", "category", "section", "is_weekend", "is_cash",
]


def load_tb(session, tb_path: str):
    print("TB 데이터 로딩 중...")
    df = pd.read_excel(tb_path)
    df = df.rename(columns=TB_COLUMN_MAP)

    missing = [c for c in TB_COLUMN_MAP.values() if c not in df.columns]
    if missing:
        raise ValueError(f"TB 파일에 필요한 컬럼이 없습니다: {missing}")

    df["account_code"] = df["account_code"].astype(str).str.split(".").str[0].str.strip()
    before = len(df)
    df = df.drop_duplicates(subset=["account_code"], keep="last")
    if len(df) < before:
        print(f"  TB: 중복 account_code {before - len(df)}건 제거됨")

    records = []
    for _, row in df.iterrows():
        sign = 1 if row["category"] == "자산" else -1
        records.append(TBAccount(
            account_code=str(row["account_code"]),
            account_name=str(row["account_name"]),
            account_name_1=str(row["account_name_1"]),
            disclosure_acct=str(row["disclosure_acct"]),
            mgmt_acct=str(row["mgmt_acct"]),
            sum_acct=str(row["sum_acct"]),
            category=str(row["category"]),
            section=str(row["section"]),
            opening_balance=float(row["opening_balance"] or 0),
            opening_signed=float(row["opening_balance"] or 0) * sign,
        ))

    session.bulk_save_objects(records)
    session.commit()
    print(f"  TB: {len(records)}개 계정 적재 완료")


def load_je(conn, je_path: str):
    total_rows = pd.read_excel(je_path).shape[0]
    print(f"JE 데이터 로딩 중... ({total_rows:,}행, 시간이 걸릴 수 있습니다)")
    df = pd.read_excel(je_path)

    # 필요한 컬럼만 이름 기반으로 매핑 (불필요한 컬럼은 자동으로 제거됨)
    df = df.rename(columns=JE_COLUMN_MAP)

    missing = [c for c in ["date", "voucher_no", "dr_cr", "amount", "account_code",
                            "disclosure_acct", "category", "section"]
               if c not in df.columns]
    if missing:
        raise ValueError(f"JE 파일에 필요한 컬럼이 없습니다: {missing}")

    df["date"] = pd.to_datetime(df["date"]).dt.date
    df["year_month"] = df["date"].astype(str).str[:7]
    df["signed_amount"] = df.apply(
        lambda r: r["amount"] if r["dr_cr"] == "차변" else -r["amount"], axis=1
    )
    df["is_weekend"] = pd.to_datetime(df["date"]).dt.dayofweek >= 5
    df["is_cash"] = df["disclosure_acct"].str.contains("현금", na=False)
    df["account_code"] = df["account_code"].astype(str)

    # record_id 없으면 자동 생성
    if "record_id" not in df.columns:
        df["record_id"] = range(1, len(df) + 1)

    # counterparty/description 없으면 빈 문자열
    for col in ["counterparty", "counterparty_raw", "description", "description_raw",
                "company_acct", "account_name", "mgmt_acct", "sum_acct"]:
        if col not in df.columns:
            df[col] = ""

    out = df[JE_OUTPUT_COLS]

    CHUNK = 10000
    total = len(out)
    for i in range(0, total, CHUNK):
        out.iloc[i:i + CHUNK].to_sql("je", conn, if_exists="append", index=False)
        print(f"  JE: {min(i + CHUNK, total):,}/{total:,} 적재 완료")

    print(f"  JE: 총 {total:,}개 전표 적재 완료")


def main():
    company = sys.argv[1] if len(sys.argv) > 1 else "ABC"

    if company not in COMPANIES:
        print(f"알 수 없는 회사명: '{company}'")
        print(f"사용 가능: {', '.join(COMPANIES.keys())}")
        sys.exit(1)

    tb_file, je_file = COMPANIES[company]
    tb_path = os.path.join(SAMPLE_DIR, tb_file)
    je_path = os.path.join(SAMPLE_DIR, je_file)

    print(f"=== EasyView DB 초기화 ({company}) ===")
    print(f"  TB: {tb_file}")
    print(f"  JE: {je_file}")

    for path in [tb_path, je_path]:
        if not os.path.exists(path):
            print(f"파일 없음: {path}")
            sys.exit(1)

    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    print("테이블 생성 완료")

    from sqlalchemy.orm import Session
    with Session(engine) as session:
        load_tb(session, tb_path)

    with engine.connect() as conn:
        load_je(conn, je_path)

    print(f"\n완료! data/easyview.db 생성됨 ({company})")


if __name__ == "__main__":
    main()
