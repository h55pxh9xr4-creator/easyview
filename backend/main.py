from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from sqlalchemy import text
from database import engine, Base
from dotenv import load_dotenv
load_dotenv()
from routers import filters, summary, pl, bs, vch, scenario, inquiry, requests as req_router, chat
from routers import admin_auth, admin_users, admin_audit, admin_groups, admin_permissions, admin_roles, admin_companies, admin_requests
from admin_seed import seed_admin_data
import admin_models  # noqa: F401 — registers tables with Base

Base.metadata.create_all(bind=engine)
seed_admin_data()

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
app.include_router(chat.router,          prefix="/api/chat",      tags=["chat"])

# media 폴더를 /media 경로로 정적 서빙
media_dir = Path(__file__).parent / "media"
media_dir.mkdir(exist_ok=True)
app.mount("/media", StaticFiles(directory=str(media_dir)), name="media")


@app.get("/")
def root():
    return {"message": "EasyView API is running"}
