"""ABC 데모 리포트 자동 시드 — AUTO_SEED_ABC=1 환경변수 시 startup에 실행"""
from pathlib import Path
from datetime import datetime

SAMPLE_DIR = Path(__file__).parent / "sample_data"
ABC_TB_PATH = SAMPLE_DIR / "ABC_TB.xlsx"
ABC_JE_PATH = SAMPLE_DIR / "ABC_JE v2.xlsx"

_TB_COL_MAP = {
    "1차 번역": "account_name_1", "계정과목": "account_name",
    "계정코드": "account_code",   "공시용계정": "disclosure_acct",
    "관리계정": "mgmt_acct",      "구분": "section",
    "분류": "category",           "합산계정": "sum_acct",
    "회사계정": "company_acct",   "기초": "opening_balance",
}
_JE_COL_MAP = {
    "일자": "date",              "전표식별번호": "voucher_no",
    "차대": "dr_cr",             "금액": "amount",
    "거래처": "counterparty_raw", "거래처(번역)": "counterparty",
    "적요": "description_raw",   "적요(번역)": "description",
    "계정코드": "account_code",   "회사계정": "company_acct",
    "1차 번역": "account_name_1", "계정과목": "account_name",
    "관리계정": "mgmt_acct",      "공시용계정": "disclosure_acct",
    "합산계정": "sum_acct",       "분류": "category",
    "구분": "section",            "RecordID": "record_id",
}


def seed_abc_report(force: bool = False) -> dict:
    """
    ABC 샘플 데이터를 active 리포트로 시드.
    이미 ABC active 리포트가 있으면 skip (force=True 로 강제 재시드).
    returns: {"skipped": True} 또는 {"report_id": int, "tb_rows": int, "je_rows": int}
    """
    import pandas as pd
    from sqlalchemy import text
    from database import SessionLocal, engine
    from admin_models import Report

    if not ABC_TB_PATH.exists() or not ABC_JE_PATH.exists():
        return {"skipped": True, "reason": "sample_data 파일 없음"}

    db = SessionLocal()
    try:
        existing = db.query(Report).filter(
            Report.company == "ABC",
            Report.is_active == True,
        ).first()
        if existing and not force:
            return {"skipped": True, "report_id": existing.id}

        # 기존 ABC active 리포트 archive
        db.query(Report).filter(
            Report.company == "ABC",
            Report.is_active == True,
        ).update({"is_active": False, "status": "archived"})
        db.commit()

        # ── TB 파싱 ──────────────────────────────────────────
        df_raw_tb = pd.read_excel(ABC_TB_PATH)
        df_raw_tb.columns = df_raw_tb.columns.str.strip()
        df_tb = df_raw_tb.rename(columns=_TB_COL_MAP)
        df_tb = df_tb.assign(
            opening_balance=pd.to_numeric(df_tb["opening_balance"], errors="coerce"),
            account_code=pd.to_numeric(df_tb["account_code"], errors="coerce"),
        )
        df_tb = df_tb.dropna(subset=["opening_balance", "account_code"]).reset_index(drop=True)
        df_tb = df_tb.drop_duplicates(subset=["account_code"], keep="last")

        if len(df_tb) == 0:
            raise ValueError("TB 파싱 결과가 비어있습니다.")

        # ── JE 파싱 ──────────────────────────────────────────
        df_raw_je = pd.read_excel(ABC_JE_PATH)
        df_raw_je.columns = df_raw_je.columns.str.strip()
        df_je = df_raw_je.rename(columns=_JE_COL_MAP)

        for col in ["voucher_no", "counterparty", "counterparty_raw", "description", "description_raw"]:
            if col not in df_je.columns:
                df_je[col] = ""
        if "record_id" not in df_je.columns:
            df_je["record_id"] = range(1, len(df_je) + 1)

        df_je = df_je.assign(amount=pd.to_numeric(df_je["amount"], errors="coerce"))
        df_je["date"] = pd.to_datetime(df_je["date"], errors="coerce")
        df_je = df_je.dropna(subset=["amount", "date"]).reset_index(drop=True)

        if len(df_je) == 0:
            raise ValueError("JE 파싱 결과가 비어있습니다.")

        df_je["date"] = df_je["date"].dt.date
        df_je["year_month"] = df_je["date"].astype(str).str[:7]

        # 기간 자동 감지 (JE 데이터의 최빈 year_month)
        period = df_je["year_month"].dropna().mode()
        period = period.iloc[0] if len(period) > 0 else "2024-03"

        # ── 리포트 레코드 생성 ─────────────────────────────────
        now = datetime.utcnow()
        report = Report(
            company="ABC",
            title=f"ABC {period[:4]}년 {period[5:7]}월 리포트",
            period=period,
            status="active",
            is_active=True,
            generated_by="SYSTEM",
            generated_at=now,
            reviewed_by="SYSTEM",
            reviewed_at=now,
            activated_at=now,
        )
        db.add(report)
        db.commit()
        db.refresh(report)
        rid = report.id

        # ── TB 적재 ──────────────────────────────────────────
        tb_records = []
        for _, row in df_tb.iterrows():
            sign = 1 if row.get("category") == "자산" else -1
            bal = float(row["opening_balance"])
            tb_records.append({
                "report_id":       rid,
                "account_code":    str(int(row["account_code"])),
                "account_name":    row.get("account_name", ""),
                "account_name_1":  row.get("account_name_1", ""),
                "disclosure_acct": row.get("disclosure_acct", ""),
                "mgmt_acct":       row.get("mgmt_acct", ""),
                "sum_acct":        row.get("sum_acct", ""),
                "category":        row.get("category", ""),
                "section":         row.get("section", ""),
                "opening_balance": bal,
                "opening_signed":  bal * sign,
            })

        with engine.connect() as conn:
            conn.execute(text("DELETE FROM tb_data WHERE report_id = :rid"), {"rid": rid})
            conn.commit()
        pd.DataFrame(tb_records).to_sql("tb_data", engine, if_exists="append", index=False)

        # ── JE 적재 ──────────────────────────────────────────
        df_je["signed_amount"] = df_je.apply(
            lambda r: r["amount"] if r["dr_cr"] == "차변" else -r["amount"], axis=1
        )
        df_je["is_weekend"] = pd.to_datetime(df_je["date"]).dt.dayofweek >= 5
        df_je["is_cash"] = df_je.get(
            "disclosure_acct", pd.Series([""] * len(df_je))
        ).str.contains("현금", na=False)
        df_je["account_code"] = df_je["account_code"].astype(str)
        df_je["report_id"] = rid

        out = df_je[[
            "report_id", "record_id", "date", "year_month", "voucher_no", "dr_cr", "amount",
            "signed_amount", "counterparty", "counterparty_raw", "description",
            "description_raw", "account_code", "account_name", "disclosure_acct",
            "mgmt_acct", "sum_acct", "category", "section", "is_weekend", "is_cash",
        ]]

        with engine.connect() as conn:
            conn.execute(text("DELETE FROM je_data WHERE report_id = :rid"), {"rid": rid})
            conn.commit()
        out.to_sql("je_data", engine, if_exists="append", index=False)

        return {"report_id": rid, "tb_rows": len(tb_records), "je_rows": len(out)}

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
