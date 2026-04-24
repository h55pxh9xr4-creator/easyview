from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from sqlalchemy import text
from database import engine, Base
from dotenv import load_dotenv
load_dotenv()
from routers import filters, summary, pl, bs, vch, scenario, inquiry, requests as req_router, chat
from routers import admin_auth, admin_users, admin_audit, admin_groups, admin_permissions, admin_roles, admin_companies, admin_requests, admin_reports
from admin_seed import seed_admin_data, patch_companies
import admin_models  # noqa: F401 — registers tables with Base
import chat_models   # noqa: F401 — registers chat session/FAQ tables

Base.metadata.create_all(bind=engine)
seed_admin_data()
patch_companies()

# FAQ 초기 데이터 seed
from database import SessionLocal
from chat_models import Faq
_db_tmp = SessionLocal()
try:
    if _db_tmp.query(Faq).count() == 0:
        initial_faqs = [
            {"category": "사용법", "question": "다크모드는 어떻게 설정하나요?",
             "answer": "다크모드는 지금 바로 아래 버튼으로 전환할 수 있어요. 🌙\n또는 설정 페이지에서도 변경 가능합니다.",
             "keywords": "다크모드,어두운,밤모드,dark,테마",
             "action_handler": "applyTheme('dark')", "priority": 10},
            {"category": "사용법", "question": "라이트모드로 전환하려면?",
             "answer": "라이트모드로 바로 전환해드릴게요! ☀️",
             "keywords": "라이트모드,밝게,light,테마",
             "action_handler": "applyTheme('light')", "priority": 10},
            {"category": "리포트", "question": "기준 연월은 어디서 바꾸나요?",
             "answer": "리포트 페이지 상단의 **필터바**에서 '기준연월'을 변경할 수 있어요.\n변경하면 모든 리포트가 자동으로 새 기간으로 갱신됩니다.",
             "keywords": "기간,연월,필터,변경", "priority": 5},
            {"category": "리포트", "question": "증감률은 어떤 기준으로 계산되나요?",
             "answer": "증감률 = (당기 - 비교기) / |비교기| × 100\n\n비교기는 **비교대상** 설정에 따라 달라집니다:\n- 전년누적: 작년 같은 기간 누적\n- 전년동월: 작년 같은 달\n- 전월: 바로 직전 월",
             "keywords": "증감률,비교,계산,기준", "priority": 3},
            {"category": "자료실", "question": "파일 업로드가 안 돼요",
             "answer": "파일 업로드는 **자료실** 페이지에서 가능합니다.\n권한 또는 파일 크기(50MB 이하)를 확인해주세요.",
             "keywords": "업로드,파일,자료실",
             "action_route": "/easyview/?page=resource", "priority": 5},
            {"category": "계정/권한", "question": "비밀번호를 변경하려면?",
             "answer": "현재는 관리자를 통해서만 변경 가능합니다.\n문의게시판에 '계정 문의' 카테고리로 등록해주세요.",
             "keywords": "비밀번호,패스워드,계정,변경",
             "action_route": "/easyview/?page=inquiry", "priority": 3},
            {"category": "기타", "question": "김삼일 매니저는 뭘 할 수 있어?",
             "answer": "저는 EasyView의 AI 어시스턴트 **김삼일**입니다! 🎩\n\n이런 것들을 도와드려요:\n- 📊 리포트 데이터 분석 (매출, 영업이익, 재무비율 등)\n- 🔍 이상 전표 탐지 (중복/주말/고액 현금)\n- 📝 문의 등록 보조\n- ⚙️ 설정 변경 (다크모드 등)\n- 🧭 페이지 이동 안내\n\n무엇이든 편하게 물어보세요!",
             "keywords": "김삼일,매니저,AI,챗봇,기능", "priority": 8},
        ]
        for fd in initial_faqs:
            _db_tmp.add(Faq(**fd))
        _db_tmp.commit()
        print(f"[FAQ] Seeded {len(initial_faqs)} initial FAQs")
finally:
    _db_tmp.close()

# 기존 DB에 corporation 컬럼이 없을 경우 자동 추가
with engine.connect() as conn:
    cols = [r[1] for r in conn.execute(text("PRAGMA table_info(inquiry)")).fetchall()]
    if "corporation" not in cols:
        conn.execute(text("ALTER TABLE inquiry ADD COLUMN corporation VARCHAR"))
        conn.commit()

app = FastAPI(title="EasyView API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # 배포 시 GitHub Pages URL로 제한
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(filters.router,    prefix="/api/filters",   tags=["filters"])
app.include_router(summary.router,    prefix="/api/summary",   tags=["summary"])
app.include_router(pl.router,         prefix="/api/pl",        tags=["pl"])
app.include_router(bs.router,         prefix="/api/bs",        tags=["bs"])
app.include_router(vch.router,        prefix="/api/vch",       tags=["vch"])
app.include_router(scenario.router,   prefix="/api/scenario",  tags=["scenario"])
app.include_router(inquiry.router,    prefix="/api/inquiry",   tags=["inquiry"])
app.include_router(req_router.router,           prefix="/api/requests",  tags=["requests"])
app.include_router(admin_auth.router)
app.include_router(admin_users.router)
app.include_router(admin_audit.router)
app.include_router(admin_groups.router)
app.include_router(admin_permissions.router)
app.include_router(admin_roles.router)
app.include_router(admin_companies.router)
app.include_router(admin_requests.router)
app.include_router(admin_reports.router)
app.include_router(chat.router,          prefix="/api/chat",      tags=["chat"])

# media 폴더를 /media 경로로 정적 서빙
media_dir = Path(__file__).parent / "media"
media_dir.mkdir(exist_ok=True)
app.mount("/media", StaticFiles(directory=str(media_dir)), name="media")


@app.get("/")
def root():
    return {"message": "EasyView API is running"}
