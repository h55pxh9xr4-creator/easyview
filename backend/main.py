from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routers import filters, summary, pl, bs, vch, scenario

Base.metadata.create_all(bind=engine)

app = FastAPI(title="EasyView API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # 배포 시 GitHub Pages URL로 제한
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(filters.router,  prefix="/api/filters",   tags=["filters"])
app.include_router(summary.router,  prefix="/api/summary",   tags=["summary"])
app.include_router(pl.router,       prefix="/api/pl",        tags=["pl"])
app.include_router(bs.router,       prefix="/api/bs",        tags=["bs"])
app.include_router(vch.router,      prefix="/api/vch",       tags=["vch"])
app.include_router(scenario.router, prefix="/api/scenario",  tags=["scenario"])


@app.get("/")
def root():
    return {"message": "EasyView API is running"}
