"""관리자 > 리포트 관리 라우터"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta, timezone
from pathlib import Path
import uuid, shutil

from database import get_db
from models import DataRequest
from admin_models import Report, ReportFile, AdminUser, AuditLog
from admin_auth import get_current_admin

router = APIRouter(prefix="/api/admin/reports", tags=["admin-reports"])

REPORT_MEDIA = Path(__file__).parent.parent / "media" / "reports"
REPORT_MEDIA.mkdir(parents=True, exist_ok=True)

KST = timezone(timedelta(hours=9))


def _kst(dt: datetime) -> str:
    if not dt:
        return ""
    return dt.replace(tzinfo=timezone.utc).astimezone(KST).strftime("%Y-%m-%d %H:%M:%S")


def _fmt_report(r: Report) -> dict:
    return {
        "id": r.id,
        "dataRequestId": r.data_request_id,
        "company": r.company,
        "title": r.title,
        "period": r.period or "",
        "status": r.status,
        "version": r.version,
        "isActive": r.is_active,
        "generatedBy": r.generated_by or "",
        "generatedAt": _kst(r.generated_at),
        "reviewedBy": r.reviewed_by or "",
        "reviewedAt": _kst(r.reviewed_at),
        "activatedAt": _kst(r.activated_at),
        "createdAt": _kst(r.created_at),
    }


def _fmt_file(f: ReportFile) -> dict:
    return {
        "id": f.id,
        "reportId": f.report_id,
        "fileType": f.file_type,
        "originalName": f.original_name,
        "size": f.size or 0,
        "uploadedBy": f.uploaded_by or "",
        "uploadedAt": _kst(f.uploaded_at),
    }


# ── 자료실 Accept 요청 목록 ─────────────────────────────────────
@router.get("/accepted-requests")
def list_accepted_requests(db: Session = Depends(get_db), _: AdminUser = Depends(get_current_admin)):
    rows = (
        db.query(DataRequest)
        .filter(DataRequest.status == "Accepted")
        .order_by(DataRequest.id.desc())
        .all()
    )
    result = []
    for r in rows:
        # 연결된 리포트가 있는지 확인
        report = db.query(Report).filter(Report.data_request_id == r.id).first()
        files = {}
        if report:
            for f in db.query(ReportFile).filter(ReportFile.report_id == report.id).all():
                files[f.file_type] = _fmt_file(f)

        result.append({
            "id": r.id,
            "reqCode": r.req_code,
            "title": r.title,
            "entity": r.entity or "",
            "requester": r.requester or "",
            "createdAt": r.created_at.strftime("%Y-%m-%d") if r.created_at else "",
            "report": _fmt_report(report) if report else None,
            "files": files,
        })
    return {"requests": result}


# ── 리포트 목록 ───────────────────────────────────────────────
@router.get("")
def list_reports(db: Session = Depends(get_db), _: AdminUser = Depends(get_current_admin)):
    rows = db.query(Report).order_by(Report.id.desc()).all()
    result = []
    for r in rows:
        files = {
            f.file_type: _fmt_file(f)
            for f in db.query(ReportFile).filter(ReportFile.report_id == r.id).all()
        }
        result.append({**_fmt_report(r), "files": files})
    return {"reports": result}


# ── 리포트 레코드 신설 ──────────────────────────────────────────
class ReportCreate(BaseModel):
    company: str
    period: Optional[str] = ""
    title: Optional[str] = ""
    data_request_id: Optional[int] = None

@router.post("", status_code=201)
def create_report(
    body: ReportCreate,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(get_current_admin),
):
    # 자료실 요청에서 연결된 경우 중복 방지
    if body.data_request_id:
        existing = db.query(Report).filter(Report.data_request_id == body.data_request_id).first()
        if existing:
            raise HTTPException(400, "이미 리포트가 생성된 요청입니다.")

    title = body.title or f"{body.company} {body.period or ''} 리포트".strip()
    report = Report(
        data_request_id=body.data_request_id,
        company=body.company,
        title=title,
        period=body.period or "",
        status="upload",
    )
    db.add(report)
    db.add(AuditLog(actor=current_user.name, action_type="리포트 생성 시작",
                    detail=f"{body.company} {body.period} 리포트 생성 시작", target=title))
    db.commit()
    db.refresh(report)
    return _fmt_report(report)


# ── 파일 업로드 (JE 또는 TB) ─────────────────────────────────
@router.post("/{report_id}/upload-file")
async def upload_report_file(
    report_id: int,
    file_type: str = Form(...),   # "JE" | "TB"
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(get_current_admin),
):
    if file_type not in ("JE", "TB"):
        raise HTTPException(400, "file_type은 JE 또는 TB 이어야 합니다.")

    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(404, "리포트를 찾을 수 없습니다.")

    # 기존 같은 타입 파일 교체
    old = db.query(ReportFile).filter(
        ReportFile.report_id == report_id,
        ReportFile.file_type == file_type,
    ).first()
    if old:
        try:
            Path(old.file_path).unlink(missing_ok=True)
        except Exception:
            pass
        db.delete(old)

    dest_dir = REPORT_MEDIA / str(report_id)
    dest_dir.mkdir(parents=True, exist_ok=True)
    ext = Path(file.filename or "").suffix
    saved_name = f"{file_type}_{uuid.uuid4().hex}{ext}"
    dest = dest_dir / saved_name

    with dest.open("wb") as f:
        shutil.copyfileobj(file.file, f)

    size = dest.stat().st_size
    rf = ReportFile(
        report_id=report_id,
        file_type=file_type,
        filename=saved_name,
        original_name=file.filename or saved_name,
        file_path=str(dest),
        size=size,
        uploaded_by=current_user.name,
    )
    db.add(rf)

    # JE와 TB가 모두 있으면 상태를 pending_generation으로
    other_type = "TB" if file_type == "JE" else "JE"
    other = db.query(ReportFile).filter(
        ReportFile.report_id == report_id,
        ReportFile.file_type == other_type,
    ).first()
    if other and report.status == "upload":
        report.status = "pending_generation"

    db.commit()
    db.refresh(rf)
    return _fmt_file(rf)


# ── 리포트 생성 (JE+TB 파싱 → DB 적재) ──────────────────────
def _run_generate(report_id: int, db_url: str, actor: str):
    """백그라운드에서 JE/TB 파싱 및 적재 수행"""
    import pandas as pd
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    eng = create_engine(db_url, connect_args={"check_same_thread": False})
    Session = sessionmaker(bind=eng)
    session = Session()

    try:
        report = session.query(Report).filter(Report.id == report_id).first()
        if not report:
            return

        je_file = session.query(ReportFile).filter(
            ReportFile.report_id == report_id, ReportFile.file_type == "JE"
        ).first()
        tb_file = session.query(ReportFile).filter(
            ReportFile.report_id == report_id, ReportFile.file_type == "TB"
        ).first()

        if not je_file or not tb_file:
            report.status = "upload"
            session.commit()
            return

        # ── TB 적재 ──────────────────────────────────────────
        df_tb = pd.read_excel(tb_file.file_path)
        df_tb.columns = [
            "account_name_1", "account_name", "account_code",
            "disclosure_acct", "mgmt_acct", "section", "category",
            "sum_acct", "company_acct", "opening_balance",
        ]
        with eng.connect() as conn:
            conn.execute(text("DELETE FROM tb_account"))
            conn.commit()

        tb_records = []
        for _, row in df_tb.iterrows():
            sign = 1 if row["category"] == "자산" else -1
            tb_records.append({
                "account_code": str(int(row["account_code"])),
                "account_name": row["account_name"],
                "account_name_1": row.get("account_name_1", ""),
                "disclosure_acct": row.get("disclosure_acct", ""),
                "mgmt_acct": row.get("mgmt_acct", ""),
                "sum_acct": row.get("sum_acct", ""),
                "category": row["category"],
                "section": row.get("section", ""),
                "opening_balance": float(row["opening_balance"] or 0),
                "opening_signed": float(row["opening_balance"] or 0) * sign,
            })
        pd.DataFrame(tb_records).to_sql("tb_account", eng, if_exists="append", index=False)

        # ── JE 적재 ──────────────────────────────────────────
        df_je = pd.read_excel(je_file.file_path)
        df_je.columns = [
            "date", "voucher_no", "dr_cr", "amount",
            "counterparty_raw", "counterparty", "description_raw", "description",
            "account_code", "company_acct", "account_name_1", "account_name",
            "mgmt_acct", "disclosure_acct", "sum_acct", "category", "section", "record_id",
        ]
        df_je["date"] = pd.to_datetime(df_je["date"]).dt.date
        df_je["year_month"] = df_je["date"].astype(str).str[:7]
        df_je["signed_amount"] = df_je.apply(
            lambda r: r["amount"] if r["dr_cr"] == "차변" else -r["amount"], axis=1
        )
        df_je["is_weekend"] = pd.to_datetime(df_je["date"]).dt.dayofweek >= 5
        df_je["is_cash"] = df_je["disclosure_acct"].str.contains("현금", na=False)
        df_je["account_code"] = df_je["account_code"].astype(str)

        out = df_je[[
            "record_id", "date", "year_month", "voucher_no", "dr_cr", "amount",
            "signed_amount", "counterparty", "counterparty_raw", "description",
            "description_raw", "account_code", "account_name", "disclosure_acct",
            "mgmt_acct", "sum_acct", "category", "section", "is_weekend", "is_cash",
        ]]
        with eng.connect() as conn:
            conn.execute(text("DELETE FROM je"))
            conn.commit()

        CHUNK = 5000
        for i in range(0, len(out), CHUNK):
            out.iloc[i:i + CHUNK].to_sql("je", eng, if_exists="append", index=False)

        # ── 상태 업데이트 ────────────────────────────────────
        report.status = "generated"
        report.generated_by = actor
        report.generated_at = datetime.utcnow()
        session.add(AuditLog(
            actor=actor,
            action_type="리포트 생성 완료",
            detail=f"리포트 #{report_id} JE/TB 데이터 적재 완료",
            target=report.title,
        ))
        session.commit()

    except Exception as e:
        report = session.query(Report).filter(Report.id == report_id).first()
        if report:
            report.status = "pending_generation"
            session.commit()
        raise e
    finally:
        session.close()


@router.post("/{report_id}/generate")
def generate_report(
    report_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(get_current_admin),
):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(404, "리포트를 찾을 수 없습니다.")
    if report.status not in ("pending_generation", "upload"):
        raise HTTPException(400, f"현재 상태({report.status})에서는 생성할 수 없습니다.")

    je = db.query(ReportFile).filter(
        ReportFile.report_id == report_id, ReportFile.file_type == "JE"
    ).first()
    tb = db.query(ReportFile).filter(
        ReportFile.report_id == report_id, ReportFile.file_type == "TB"
    ).first()
    if not je or not tb:
        raise HTTPException(400, "JE와 TB 파일이 모두 업로드되어야 합니다.")

    report.status = "pending_generation"
    db.commit()

    from database import DATABASE_URL
    background_tasks.add_task(_run_generate, report_id, DATABASE_URL, current_user.name)
    return {"message": "리포트 생성을 시작했습니다. 잠시 후 현황 탭에서 확인하세요."}


# ── 상태 변경 ─────────────────────────────────────────────────
class StatusUpdate(BaseModel):
    status: str   # reviewing | active | archived

@router.put("/{report_id}/status")
def update_status(
    report_id: int,
    body: StatusUpdate,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(get_current_admin),
):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(404, "리포트를 찾을 수 없습니다.")

    ALLOWED = {
        "generated": ["reviewing"],
        "reviewing": ["active", "generated"],
        "active":    ["archived"],
        "archived":  [],
    }
    if body.status not in ALLOWED.get(report.status, []):
        raise HTTPException(400, f"{report.status} 상태에서 {body.status}로 변경할 수 없습니다.")

    now = datetime.utcnow()

    if body.status == "reviewing":
        report.reviewed_by = current_user.name
        report.reviewed_at = now
    elif body.status == "active":
        # 기존 active 리포트를 archived로
        db.query(Report).filter(
            Report.company == report.company,
            Report.is_active == True,
            Report.id != report_id,
        ).update({"is_active": False, "status": "archived"})
        report.is_active = True
        report.activated_at = now
    elif body.status == "archived":
        report.is_active = False

    report.status = body.status
    db.add(AuditLog(
        actor=current_user.name,
        action_type="리포트 상태 변경",
        detail=f"리포트 #{report_id} {report.status} → {body.status}",
        target=report.title,
    ))
    db.commit()
    return {"message": f"상태가 {body.status}로 변경되었습니다."}
