"""청구 관리 더미 데이터 시드 — 배포 환경에서 샘플 법인 demo용.

- Asset/Easy View 빌링현황.xlsm 이 없는 환경(Render 배포 등)에서도 빌링 페이지가 비지 않도록
  샘플 master + pending/completed billing_entry 를 채움.
- Idempotent: 이미 billing_master가 있으면 스킵.
- 실제 데이터 import(import_billing.py)가 돌면 이 seed는 overwrite 됨.
"""
from datetime import date, timedelta
from database import SessionLocal
from billing_models import BillingEntry, BillingMaster, BillingException


# 풀무원·ENF·LOT Vacuum 등 실제 엑셀 샘플 기반 — 민감 정보는 dummy로 교체
_MASTER_SEED = [
    {
        "mgmt_no": "13762-01", "parent": "풀무원식품", "company": "Pulmuone Vietnam Co., Ltd. (베트남)",
        "amount": 400000, "invoice_request_day": "매월 5일(리포트 발송 여부 무관)",
        "invoice_manager": "윤승현", "manager_email": "sh.yun@pulmuone.example",
        "manager_phone": None,
    },
    {
        "mgmt_no": "25372-02", "parent": "이엔에프테크놀로지", "company": "ENF(Guangzhou) technology CO., LTD",
        "amount": 400000, "invoice_request_day": "매월 말",
        "invoice_manager": "박민", "manager_email": "agilemin@enftech.example",
        "manager_phone": None,
    },
    {
        "mgmt_no": "25188-01", "parent": "삼진글로벌넷", "company": "㈜삼진 지.에프",
        "amount": 400000, "invoice_request_day": "매월 말",
        "invoice_manager": "유민혁", "manager_email": "ymh@wangfood.example",
        "manager_phone": None,
    },
    {
        "mgmt_no": "11189-01", "parent": "일양약품", "company": "양주일양제약유한공사 (중국)",
        "amount": 400000, "invoice_request_day": "익월 5일(리포트 발송 여부 무관)",
        "invoice_manager": "김종헌 팀장", "manager_email": "jhkim10@ilyang.example",
        "manager_phone": "010-9139-2455",
    },
    {
        "mgmt_no": "05168-01", "parent": "엘오티베큠", "company": "LOT Vacuum Xi'an Corporation",
        "amount": 300000, "invoice_request_day": "익월 5일(리포트 발송 여부 무관)",
        "invoice_manager": "오야니, 오정", "manager_email": "linda@lotvacuum.example",
        "manager_phone": "+86-138-2191-6339",
    },
    {
        "mgmt_no": "22606-01", "parent": "엘앤피코스메틱", "company": "마녀공장",
        "amount": 300000, "invoice_request_day": "매월 말",
        "invoice_manager": "김현경", "manager_email": "hkkim@medihealcos.example",
        "manager_phone": None,
    },
    {
        "mgmt_no": "13286-01", "parent": "가온그룹", "company": "KAON DO BRASIL INDUSTRIA ELETRONICA LTDA. (브라질)",
        "amount": 400000, "invoice_request_day": "익월 5일",
        "invoice_manager": "김수환", "manager_email": "sh.kim@kaon.example",
        "manager_phone": None,
    },
    {
        "mgmt_no": "37257-01", "parent": "콘크리트웍스", "company": "콘크리트웍스",
        "amount": 300000, "invoice_request_day": "매월 말",
        "invoice_manager": "이광희", "manager_email": "lkh.ms@concreteworks.example",
        "manager_phone": None,
    },
]

_EXCEPTION_SEED = [
    {"no": 1, "category": "비고 체크", "parent": "에스엘즈",
     "note": "월별 1개 리포트만 청구(ex: 9월에 7,8월 리포트가 송부되었어도 7월(1개월치)의 리포트만 청구)"},
    {"no": 2, "category": "비고 체크", "parent": "한국제지",
     "note": "사업장 07747-001 로 청구 / 종사업장번호 '0001'"},
    {"no": 3, "category": "빌링(결과물 무관)", "parent": "일양약품",
     "note": "리포트 발송 여부와 상관 없이 매월 400,000원씩 청구, 매월 5일 발행"},
    {"no": 4, "category": "분기 입금", "parent": "엘앤피코스메틱",
     "note": "분기별 입금 처리"},
]

# 샘플 빌링 건 (2026년 3월 기준 대기중 + 2025년 하반기 완료건 몇 개)
def _build_entry_seed():
    today = date.today()
    this_month_ym = f"{today.year}년 {today.month}월"
    last_month = today.replace(day=1) - timedelta(days=1)
    last_month_ym = f"{last_month.year}년 {last_month.month}월"

    # 이번 달 발행 예정
    pending = [
        {
            "parent": "풀무원식품", "subsidiary": "Pulmuone Vietnam Co., Ltd. (베트남)",
            "mgmt_no": "13762-01", "assignee": "Yubin Y Choi",
            "report_ym": last_month_ym, "delivery_ym": this_month_ym,
            "invoice_date": today.replace(day=min(5, 28)),
            "status": "빌링대기중", "amount": 400000,
            "invoice_request_day": "매월 5일(리포트 발송 여부 무관)",
            "invoice_manager": "윤승현", "manager_email": "sh.yun@pulmuone.example",
        },
        {
            "parent": "이엔에프테크놀로지", "subsidiary": "ENF(Guangzhou) technology CO., LTD",
            "mgmt_no": "25372-02", "assignee": "Seungyeon S Han",
            "report_ym": last_month_ym, "delivery_ym": this_month_ym,
            "invoice_date": today.replace(day=28) if today.day <= 28 else today,
            "status": "빌링대기중", "amount": 400000,
            "invoice_request_day": "매월 말",
            "invoice_manager": "박민", "manager_email": "agilemin@enftech.example",
        },
        {
            "parent": "삼진글로벌넷", "subsidiary": "㈜삼진 지.에프",
            "mgmt_no": "25188-01", "assignee": "정예림",
            "report_ym": last_month_ym, "delivery_ym": this_month_ym,
            "invoice_date": today.replace(day=28) if today.day <= 28 else today,
            "status": "빌링대기중", "amount": 400000,
            "invoice_request_day": "매월 말",
            "invoice_manager": "유민혁", "manager_email": "ymh@wangfood.example",
        },
        {
            "parent": "일양약품", "subsidiary": "양주일양제약유한공사 (중국)",
            "mgmt_no": "11189-01", "assignee": "조현우",
            "report_ym": last_month_ym, "delivery_ym": this_month_ym,
            "invoice_date": None,
            "status": "빌링대기중", "amount": 400000,
            "invoice_request_day": "익월 5일(리포트 발송 여부 무관)",
            "invoice_manager": "김종헌 팀장",
            "manager_email": "jhkim10@ilyang.example", "manager_phone": "010-9139-2455",
            "memo": "리포트 발송 여부와 상관 없이 매월 400,000원씩 청구",
        },
        {
            "parent": "엘오티베큠", "subsidiary": "LOT Vacuum Xi'an Corporation",
            "mgmt_no": "05168-01", "assignee": "박수정",
            "report_ym": last_month_ym, "delivery_ym": this_month_ym,
            "invoice_date": None,
            "status": "빌링대기중", "amount": 300000,
            "invoice_request_day": "익월 5일(리포트 발송 여부 무관)",
            "invoice_manager": "오야니, 오정",
            "manager_email": "linda@lotvacuum.example", "manager_phone": "+86-138-2191-6339",
            "memo": "매월 CNY1,600 청구, Invoice TO 주소 변경분 확인 필요",
        },
    ]

    # 완료된 과거 건
    q1_end = date(2025, 11, 5)
    q1_deposit = date(2025, 11, 20)
    completed = [
        {
            "parent": "가온그룹", "subsidiary": "KAON DO BRASIL INDUSTRIA ELETRONICA LTDA. (브라질)",
            "mgmt_no": "13286-01", "assignee": "한여원",
            "report_ym": "2025년 9월", "delivery_ym": "2025년 10월",
            "billing_date": q1_end, "invoice_date": q1_end, "deposit_date": q1_deposit,
            "status": "완료", "is_completed": True, "transfer_at": date(2025, 11, 6),
            "amount": 400000,
            "invoice_manager": "김수환",
        },
        {
            "parent": "풀무원식품", "subsidiary": "Pulmuone Vietnam Co., Ltd. (베트남)",
            "mgmt_no": "13762-01", "assignee": "Yubin Y Choi",
            "report_ym": "2025년 12월", "delivery_ym": "2026년 1월",
            "billing_date": date(2026, 1, 5), "invoice_date": date(2026, 1, 5),
            "deposit_date": date(2026, 1, 28),
            "status": "완료", "is_completed": True, "transfer_at": date(2026, 1, 10),
            "amount": 400000,
        },
        {
            "parent": "엘앤피코스메틱", "subsidiary": "마녀공장",
            "mgmt_no": "22606-01", "assignee": "Seungyeon S Han",
            "report_ym": "2025년 12월", "delivery_ym": "2026년 1월",
            "billing_date": date(2026, 1, 31), "invoice_date": date(2026, 1, 31),
            "deposit_date": None,  # 미입금
            "status": "완료", "is_completed": True, "transfer_at": date(2026, 2, 1),
            "amount": 300000,
            "memo": "분기별 입금 — 2026 Q1 기대",
        },
    ]
    return pending, completed


def seed_billing_demo(force: bool = False) -> dict:
    """Billing 더미 데이터 시드. 이미 billing_master가 있으면 스킵 (force=True면 덮어씀)."""
    db = SessionLocal()
    try:
        if not force and db.query(BillingMaster).count() > 0:
            return {"skipped": True, "reason": "already seeded"}

        # Master
        for m in _MASTER_SEED:
            exists = db.query(BillingMaster).filter(BillingMaster.mgmt_no == m["mgmt_no"]).first()
            if exists:
                for k, v in m.items():
                    setattr(exists, k, v)
            else:
                db.add(BillingMaster(**m))

        # Exceptions
        for e in _EXCEPTION_SEED:
            db.add(BillingException(**e))

        # Entries
        pending, completed = _build_entry_seed()
        for p in pending + completed:
            exists = db.query(BillingEntry).filter(
                BillingEntry.mgmt_no == p["mgmt_no"],
                BillingEntry.report_ym == p["report_ym"],
            ).first()
            if exists:
                continue
            db.add(BillingEntry(**p))

        db.commit()
        return {
            "master": len(_MASTER_SEED),
            "exceptions": len(_EXCEPTION_SEED),
            "pending": len(pending),
            "completed": len(completed),
        }
    finally:
        db.close()


if __name__ == "__main__":
    r = seed_billing_demo(force=True)
    print(f"[billing seed] {r}")
