"""고객사 FAQ 엑셀(Asset/Easy View 고객사 FAQ.xlsx) → DB 일괄 import.

- 재실행 안전: question 텍스트가 이미 있으면 answer/category만 갱신(upsert)
- 실행: python -m import_customer_faqs  (backend 디렉터리에서)
"""
from pathlib import Path
import openpyxl
from database import SessionLocal
from chat_models import Faq

EXCEL_PATH = Path(__file__).resolve().parent.parent / "Asset" / "Easy View 고객사 FAQ.xlsx"

# 카테고리별 간단 키워드 부스터 (검색/매칭 정확도 향상)
CATEGORY_HINT_KEYWORDS = {
    "서비스": "Easy View,서비스,리포트,웹,이메일,구독",
    "계약": "계약,기간,연장,종료,감사협의공문,절차",
    "청구": "청구,세금계산서,비용,발행",
    "요금": "요금,이용료,비용,가격",
    "프리미엄": "프리미엄,커스터마이징,연결,다수법인",
    "자료": "자료,데이터,통화,환율,결산,업로드,Connect",
    "운영": "담당자,수령자,법인,변경,추가",
    "안내": "매뉴얼,설명회,Kick-off,안내",
    "문의": "문의,연락,이메일,kr_easyview",
}


def _derive_keywords(category: str, question: str, answer: str) -> str:
    """질문/답변에서 핵심 명사를 수기 추출하지 않고, 카테고리 힌트 + 질문 그대로 결합."""
    parts = []
    if category:
        parts.append(CATEGORY_HINT_KEYWORDS.get(category, category))
    # 질문 자체도 키워드로 활용 (공백 → 쉼표)
    parts.append(question.replace("?", "").strip())
    return ",".join(p for p in parts if p)


def load_rows() -> list[dict]:
    wb = openpyxl.load_workbook(EXCEL_PATH, data_only=True)
    ws = wb.worksheets[0]
    rows: list[dict] = []
    header = None
    for i, row in enumerate(ws.iter_rows(values_only=True), 1):
        if i == 1:
            header = [str(c or "").strip() for c in row]
            continue
        if not row or not row[2] or not row[3]:  # Question/Answer 없으면 skip
            continue
        cat = (row[1] or "고객사FAQ").strip() if row[1] else "고객사FAQ"
        q = str(row[2]).strip()
        a = str(row[3]).strip()
        rows.append({"category": cat, "question": q, "answer": a})
    return rows


def upsert_faqs() -> tuple[int, int]:
    rows = load_rows()
    db = SessionLocal()
    inserted, updated = 0, 0
    try:
        for r in rows:
            existing = db.query(Faq).filter(Faq.question == r["question"]).first()
            kw = _derive_keywords(r["category"], r["question"], r["answer"])
            if existing:
                existing.category = r["category"]
                existing.answer = r["answer"]
                existing.keywords = kw
                existing.is_published = True
                updated += 1
            else:
                db.add(Faq(
                    category=r["category"],
                    question=r["question"],
                    answer=r["answer"],
                    keywords=kw,
                    priority=1,
                    is_published=True,
                ))
                inserted += 1
        db.commit()
    finally:
        db.close()
    return inserted, updated


if __name__ == "__main__":
    ins, upd = upsert_faqs()
    print(f"[고객사 FAQ import] inserted={ins}, updated={upd}")
