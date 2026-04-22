# EasyView API 명세서

**Base URL:** `https://{host}`  
**Version:** 1.0.0  
**인증 방식:** Bearer Token (JWT) — Admin 전용 엔드포인트만 인증 필요

---

## 목차

0. [개발 환경 설정](#0-개발-환경-설정)
1. [공통 사항](#공통-사항)
2. [필터 (Filters)](#1-필터-filters)
3. [Summary 대시보드](#2-summary-대시보드)
4. [PL 손익분석](#3-pl-손익분석)
5. [BS 재무상태분석](#4-bs-재무상태분석)
6. [VCH 전표분석](#5-vch-전표분석)
7. [Scenario 시나리오분석](#6-scenario-시나리오분석)
8. [문의게시판 (Inquiry)](#7-문의게시판-inquiry)
9. [자료요청 (Requests)](#8-자료요청-requests)
10. [김삼일 AI 챗봇 (Chat)](#10-김삼일-ai-챗봇-chat)
11. [Admin 인증](#11-admin-인증)
12. [Admin 사용자 관리](#12-admin-사용자-관리)
13. [Admin 그룹 관리](#13-admin-그룹-관리)
14. [Admin 권한 관리](#14-admin-권한-관리)
15. [Admin 역할 관리](#15-admin-역할-관리)
16. [Admin 활동 로그](#16-admin-활동-로그)
17. [Admin 보안](#17-admin-보안)
18. [Admin 회사 관리](#18-admin-회사-관리)
19. [Admin 사용자 추가 요청](#19-admin-사용자-추가-요청)

---

## 0. 개발 환경 설정

### 프로젝트 구조

```
easyview-api/
├── backend/                  # FastAPI 백엔드
│   ├── main.py               # 앱 진입점
│   ├── database.py           # DB 연결 (SQLite)
│   ├── models.py             # SQLAlchemy 모델 (JE, TB 등)
│   ├── admin_models.py       # Admin 모델 (User, Group 등)
│   ├── schemas.py            # Pydantic 스키마
│   ├── admin_auth.py         # JWT 인증
│   ├── email_service.py      # 이메일 발송
│   ├── config.py             # 설정
│   ├── seed.py / admin_seed.py  # 초기 데이터
│   ├── requirements.txt      # Python 의존성
│   ├── .env                  # 환경변수 (git 미추적)
│   ├── easyview.db           # SQLite DB 파일
│   └── routers/
│       ├── filters.py        # 필터
│       ├── summary.py        # Summary 대시보드
│       ├── pl.py             # PL 손익분석
│       ├── bs.py             # BS 재무상태분석
│       ├── vch.py            # VCH 전표분석
│       ├── scenario.py       # Scenario 시나리오분석
│       ├── inquiry.py        # 문의게시판
│       ├── requests.py       # 자료요청
│       ├── chat.py           # 김삼일 AI 챗봇
│       └── admin_*.py        # Admin 라우터들
├── frontend/                 # Next.js 프론트엔드
│   ├── app/                  # 페이지
│   ├── components/           # 컴포넌트
│   ├── hooks/                # 커스텀 훅
│   ├── lib/                  # API 클라이언트, 유틸
│   └── package.json
├── data/
│   └── easyview.db           # 원본 DB
└── render.yaml               # Render 배포 설정
```

### Git 브랜치 워크플로우

```bash
git checkout master
git pull origin master
git checkout -b feature/{작업명}    # 브랜치 생성
# ... 작업 ...
git add .
git commit -m "커밋 내용"
git push origin feature/{작업명}
# → GitHub에서 PR 생성 (master에 merge)
```

**브랜치 네이밍 규칙:** `feature/{작업내용}` (영어 소문자)

| 작업            | 브랜치명                |
|-----------------|-------------------------|
| 자료실          | `feature/resource-room` |
| 문의게시판      | `feature/inquiry`       |
| 관리자 페이지   | `feature/admin`         |
| 리포트          | `feature/report`        |
| AI 챗봇         | `feature/ai-chatbot`    |

### 백엔드 로컬 실행

```bash
cd backend

# 1. 가상환경 생성 (최초 1회)
python -m venv venv
source venv/bin/activate        # Mac/Linux
venv\Scripts\activate           # Windows

# 2. 패키지 설치
pip install -r requirements.txt

# 3. 환경변수 설정 — .env 파일 생성
cat > .env << 'EOF'
OPENAI_API_KEY=sk-ufGsrl_pJl4D9Fp_GTtb1w
OPENAI_BASE_URL=https://genai-sharedservice-americas.pwcinternal.com
CHAT_MODEL=gpt-4o
EOF

# 4. 서버 실행
uvicorn main:app --reload --port 8000
```

> `.env` 파일은 `.gitignore`에 포함되어 있어 git에 추적되지 않습니다.

### 프론트엔드 로컬 실행

```bash
cd frontend

# 1. 패키지 설치
npm install

# 2. 개발 서버 실행
npm run dev
```

> `next.config.ts`에 `basePath: "/easyview"` 설정이 되어 있어, 로컬에서는 `http://localhost:3000/easyview` 로 접속해야 합니다.

### 배포 URL

| 환경     | 백엔드 (FastAPI)                     | 프론트엔드 (Next.js)                               |
|----------|--------------------------------------|-----------------------------------------------------|
| 로컬     | `http://localhost:8000`              | `http://localhost:3000/easyview`                    |
| 배포     | Render (render.yaml 참조)            | GitHub Pages (`/easyview`)                          |

### 프론트엔드 환경변수

| 변수                     | 설명             | 기본값                  |
|--------------------------|------------------|-------------------------|
| `NEXT_PUBLIC_API_URL`    | 백엔드 API URL   | `http://localhost:8000` |
| `NEXT_PUBLIC_BASE_PATH`  | 정적 파일 경로   | `/easyview`             |

---

## GenAI (김삼일 AI 챗봇) 설정

### PwC GenAI Shared Service

김삼일 AI 챗봇은 **PwC GenAI Shared Service**를 통해 LLM을 호출합니다.

| 항목           | 값                                                              |
|----------------|-----------------------------------------------------------------|
| **API Key**    | `sk-ufGsrl_pJl4D9Fp_GTtb1w`                                   |
| **Base URL (Internal)** | `https://genai-sharedservice-americas.pwcinternal.com` |
| **Base URL (External)** | `https://genai-sharedservice-americas.pwc.com`         |
| **사용 모델**  | `gpt-4o` (변경 가능)                                           |
| **모델 목록 확인** | `https://genai-sharedservice-americas.pwcinternal.com/genai/models` |
| **가이드 문서** | [Migration Guide (SharePoint)](https://pwc.sharepoint.com/sites/GBL-IFS-GlobalTechPortfolio/Documentation-AI-Services/SitePages/Migration-Guide-for-GenAI-Shared-Service.aspx) |

> **네트워크 요구사항:** PwC Internal URL은 **사내 네트워크 또는 VPN** 연결이 필요합니다.

### 백엔드 환경변수 (.env)

```env
# PwC GenAI Shared Service
OPENAI_API_KEY=sk-ufGsrl_pJl4D9Fp_GTtb1w
OPENAI_BASE_URL=https://genai-sharedservice-americas.pwcinternal.com
CHAT_MODEL=gpt-4o
```

| 변수              | 필수 | 설명                                         |
|-------------------|------|----------------------------------------------|
| `OPENAI_API_KEY`  | O    | PwC GenAI Shared Service API Key             |
| `OPENAI_BASE_URL` | O    | Internal 또는 External URL                   |
| `CHAT_MODEL`      | X    | 사용할 모델 (기본값: `gpt-4o`)               |

### SDK 호환성

PwC GenAI Shared Service는 **OpenAI API 호환** 형태이므로, 아래 SDK 중 선택하여 사용 가능합니다.

| SDK         | 설치                          | 현재 사용 여부 |
|-------------|-------------------------------|----------------|
| **OpenAI**  | `pip install openai`          | ✅ 사용 중     |
| LangChain   | `pip install langchain-openai langchain` | 미사용 |
| LiteLLM     | `pip install litellm`         | 미사용         |

```python
# 현재 프로젝트에서 사용 중인 방식 (OpenAI SDK)
from openai import OpenAI

client = OpenAI(
    api_key="sk-ufGsrl_pJl4D9Fp_GTtb1w",
    base_url="https://genai-sharedservice-americas.pwcinternal.com",
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello"}],
)
```

### 아키텍처

```
사용자 질문 + 페이지 컨텍스트
       │
       ▼
┌─ 프론트엔드 (ChatBot.tsx) ──────────────┐
│  POST /api/chat/message                  │
│  { message, base_ym, page, history }     │
└──────────────┬───────────────────────────┘
               ▼
┌─ 백엔드 (routers/chat.py) ──────────────┐
│  1. 시스템 프롬프트 (김삼일 페르소나)    │
│  2. OpenAI API 호출 (Function Calling)   │
│     → 모델이 tool 선택                   │
│     → DB에서 실시간 데이터 조회          │
│     → 결과를 모델에 전달                 │
│  3. 김삼일 스타일로 최종 답변 생성       │
└──────────────┬───────────────────────────┘
               ▼
┌─ PwC GenAI Shared Service ──────────────┐
│  gpt-4o (OpenAI 호환 API)                │
└──────────────────────────────────────────┘
```

---

## 공통 사항

### 인증 Header (Admin 전용)

| Header          | Type   | 필수 | 설명                          |
|-----------------|--------|------|-------------------------------|
| `Authorization` | string | O    | `Bearer {access_token}` 형식 |

### 공통 필터 파라미터

리포트 관련 API에서 반복 사용되는 Query Parameter입니다.

| Parameter        | Type   | 기본값           | 설명                                                         |
|------------------|--------|------------------|--------------------------------------------------------------|
| `base_ym`        | string | (필수)           | 기준 연월 (`YYYY-MM`, 예: `2025-09`)                         |
| `period_type`    | string | `cumulative`     | `monthly` (당월) / `cumulative` (누적)                       |
| `compare_target` | string | `prev_year_cum`  | `prev_year_cum` / `prev_year_month` / `prev_month`          |
| `bs_base`        | string | `year_start`     | BS 비교기준: `year_start` (기초) / `month_start` (전월말)    |

### 공통 에러 응답

| Status Code | 설명                    | Response Body                                                  |
|-------------|-------------------------|----------------------------------------------------------------|
| 401         | 인증 실패 / 토큰 만료   | `{"detail": "유효하지 않은 토큰입니다."}`                      |
| 404         | 리소스 없음             | `{"detail": "Not found"}`                                      |
| 422         | 유효성 검증 실패        | `{"detail": [{"loc": [...], "msg": "...", "type": "..."}]}`    |

---

## 1. 필터 (Filters)

### 1.1 사용 가능한 연월 목록

- **URL:** `GET /api/filters/months`
- **인증:** 불필요

**Response Body** `200 OK`

```json
["2025-09", "2025-08", "2025-07", "2024-12"]
```

| Type     | 설명                              |
|----------|-----------------------------------|
| string[] | 사용 가능한 연월 목록 (최신순)    |

---

## 2. Summary 대시보드

### 2.1 KPI 지표

- **URL:** `GET /api/summary/kpi`
- **인증:** 불필요

**Query Parameters**

| Parameter        | Type   | 필수 | 설명              |
|------------------|--------|------|--------------------|
| `base_ym`        | string | O    | 기준 연월          |
| `period_type`    | string | X    | 기간 유형          |
| `compare_target` | string | X    | 비교 대상          |
| `bs_base`        | string | X    | BS 비교 기준       |

**Response Body** `200 OK`

| Field                            | Type   | 설명                    |
|----------------------------------|--------|-------------------------|
| `revenue`                        | object | 매출액 KPI              |
| `revenue.value`                  | float  | 당기 값                 |
| `revenue.prior`                  | float  | 비교기 값               |
| `revenue.change_pct`             | float  | 증감률 (소수)           |
| `revenue.vs`                     | string | 비교 라벨 ("vs 전년누적" 등) |
| `operating_income`               | object | 영업이익 KPI (동일 구조) |
| `asset`                          | object | 자산 KPI (동일 구조)    |
| `liability`                      | object | 부채 KPI (동일 구조)    |

```json
{
  "revenue": { "value": 5000000, "prior": 4200000, "change_pct": 0.1905, "vs": "vs 전년누적" },
  "operating_income": { "value": 800000, "prior": 700000, "change_pct": 0.1429, "vs": "vs 전년누적" },
  "asset": { "value": 12000000, "prior": 11000000, "change_pct": 0.0909, "vs": "vs 기초" },
  "liability": { "value": 6000000, "prior": 5500000, "change_pct": 0.0909, "vs": "vs 기초" }
}
```

---

### 2.2 PL 요약 테이블

- **URL:** `GET /api/summary/pl_table`
- **인증:** 불필요

**Query Parameters**

| Parameter        | Type   | 필수 |
|------------------|--------|------|
| `base_ym`        | string | O    |
| `period_type`    | string | X    |
| `compare_target` | string | X    |

**Response Body** `200 OK` — `PLTableRow[]`

| Field        | Type   | 설명                       |
|--------------|--------|----------------------------|
| `account`    | string | 계정명 (매출액, 매출원가 등) |
| `current`    | float  | 당기 금액                  |
| `prior`      | float  | 비교기 금액                |
| `change_pct` | float  | 증감률                     |
| `is_subtotal`| bool   | 소계 행 여부               |

---

### 2.3 BS 요약 테이블

- **URL:** `GET /api/summary/bs_table`
- **인증:** 불필요

**Query Parameters**

| Parameter | Type   | 필수 |
|-----------|--------|------|
| `base_ym` | string | O    |
| `bs_base` | string | X    |

**Response Body** `200 OK` — `BSTableRow[]`

| Field        | Type   | 설명                          |
|--------------|--------|-------------------------------|
| `account`    | string | 항목명 (자산, 유동자산 등)    |
| `current`    | float  | 기말 금액                     |
| `prior`      | float  | 기초 금액                     |
| `change_pct` | float  | 증감률                        |
| `indent`     | int    | 들여쓰기 (0=대분류, 1=소분류) |

---

### 2.4 재무 지표

- **URL:** `GET /api/summary/indicators`
- **인증:** 불필요

**Query Parameters**

| Parameter        | Type   | 필수 |
|------------------|--------|------|
| `base_ym`        | string | O    |
| `period_type`    | string | X    |
| `compare_target` | string | X    |

**Response Body** `200 OK`

| Field                       | Type  | 설명              |
|-----------------------------|-------|-------------------|
| `pl.gross_profit_margin`    | float | 매출총이익률      |
| `pl.operating_margin`       | float | 영업이익률        |
| `pl.net_margin`             | float | 순이익률          |
| `bs.current_ratio`          | float | 유동비율          |
| `bs.debt_ratio`             | float | 부채비율          |

---

### 2.5 Top3 증감

- **URL:** `GET /api/summary/top3`
- **인증:** 불필요

**Query Parameters**

| Parameter     | Type   | 필수 |
|---------------|--------|------|
| `base_ym`     | string | O    |
| `period_type` | string | X    |

**Response Body** `200 OK`

| Field                     | Type         | 설명                    |
|---------------------------|--------------|-------------------------|
| `revenue_counterparty`    | Top3Item[]   | 매출 거래처 Top3        |
| `cost_account`            | Top3Item[]   | 비용 계정 Top3          |
| `asset_account`           | Top3Item[]   | 자산 계정 Top3          |
| `liability_account`       | Top3Item[]   | 부채 계정 Top3          |

**Top3Item 구조**

| Field     | Type   | 설명                   |
|-----------|--------|------------------------|
| `rank`    | int    | 순위                   |
| `name`    | string | 항목명                 |
| `value`   | float  | 증감 금액              |
| `bar_pct` | float  | 바 차트 비율 (0~100)   |

---

### 2.6 시나리오 건수

- **URL:** `GET /api/summary/scenario_count`
- **인증:** 불필요

**Query Parameters**

| Parameter | Type   | 필수 |
|-----------|--------|------|
| `base_ym` | string | O    |

**Response Body** `200 OK`

| Field | Type | 설명                          |
|-------|------|-------------------------------|
| `sc1` | int  | SC1 동일금액 중복 전표 건수   |
| `sc2` | int  | SC2 현금지급 후 부채인식 건수 |
| `sc3` | int  | SC3 주말 현금지급 건수        |
| `sc4` | int  | SC4 고액 현금지급 건수        |
| `sc5` | int  | SC5 비용+현금 동시기표 건수   |
| `sc6` | int  | SC6 희소 거래처 수            |

---

## 3. PL 손익분석

### 3.1 PL Summary

- **URL:** `GET /api/pl/summary`
- **인증:** 불필요

**Query Parameters**

| Parameter     | Type   | 필수 |
|---------------|--------|------|
| `base_ym`     | string | O    |
| `period_type` | string | X    |

**Response Body** `200 OK`

| Field                  | Type   | 설명                          |
|------------------------|--------|-------------------------------|
| `current`              | object | 당기 PL (아래 구조)           |
| `prior`                | object | 전기 PL (동일 구조)           |
| `prev_month_rev_diff`  | float  | 전월 대비 매출 차이           |
| `change`               | object | 항목별 증감률                 |

**current / prior 내부 구조**

| Field              | Type  | 설명        |
|--------------------|-------|-------------|
| `revenue`          | float | 매출액      |
| `cogs`             | float | 매출원가    |
| `sga`              | float | 판관비      |
| `other_income`     | float | 기타수익    |
| `other_expense`    | float | 기타비용    |
| `fin_income`       | float | 금융수익    |
| `fin_expense`      | float | 금융비용    |
| `tax`              | float | 법인세비용  |
| `gross_profit`     | float | 매출총이익  |
| `operating_income` | float | 영업이익    |
| `net_income`       | float | 당기순이익  |

---

### 3.2 PL 월별 추이

- **URL:** `GET /api/pl/trend`
- **인증:** 불필요

**Query Parameters**

| Parameter     | Type   | 필수 |
|---------------|--------|------|
| `base_ym`     | string | O    |
| `period_type` | string | X    |

**Response Body** `200 OK` — `array`

| Field              | Type   | 설명                    |
|--------------------|--------|-------------------------|
| `year_month`       | string | 연월                    |
| `revenue`          | float  | 매출액                  |
| `gross_profit`     | float  | 매출총이익              |
| `operating_income` | float  | 영업이익                |
| `net_income`       | float  | 당기순이익              |
| `is_current_year`  | bool   | 당기 여부               |

---

### 3.3 PL Waterfall

- **URL:** `GET /api/pl/waterfall`
- **인증:** 불필요

**Query Parameters**

| Parameter | Type   | 필수 |
|-----------|--------|------|
| `base_ym` | string | O    |

**Response Body** `200 OK` — `array`

| Field              | Type   | 설명       |
|--------------------|--------|------------|
| `year_month`       | string | 연월       |
| `revenue`          | float  | 매출액     |
| `cogs`             | float  | 매출원가   |
| `sga`              | float  | 판관비     |
| `gross_profit`     | float  | 매출총이익 |
| `other_net`        | float  | 기타손익   |
| `operating_income` | float  | 영업이익   |
| `net_income`       | float  | 당기순이익 |

---

### 3.4 PL 계정별 월별 추이 (미니차트)

- **URL:** `GET /api/pl/trend_by_account`
- **인증:** 불필요

**Query Parameters**

| Parameter | Type   | 필수 |
|-----------|--------|------|
| `base_ym` | string | O    |

**Response Body** `200 OK` — `array`

| Field            | Type              | 설명                     |
|------------------|-------------------|--------------------------|
| `mgmt_acct`      | string            | 관리계정명               |
| `disclosure_acct`| string            | 공시용계정명             |
| `cur`            | object            | 당기 `{연월: 금액}` map  |
| `pri`            | object            | 전기 `{연월: 금액}` map  |

---

### 3.5 PL 계정분석 (드릴다운)

- **URL:** `GET /api/pl/account`
- **인증:** 불필요

**Query Parameters**

| Parameter     | Type   | 필수 |
|---------------|--------|------|
| `base_ym`     | string | O    |
| `period_type` | string | X    |

**Response Body** `200 OK` — `array`

| Field            | Type   | 설명                             |
|------------------|--------|----------------------------------|
| `disclosure_acct`| string | 공시용계정 (매출액, 매출원가 등) |
| `mgmt_acct`      | string | 관리계정                         |
| `account_name`   | string | 계정과목                         |
| `category`       | string | 수익 / 비용                      |
| `current`        | float  | 당기                             |
| `prior`          | float  | 전기                             |
| `change_pct`     | float  | 증감률                           |

---

### 3.6 PL 계정 상세

- **URL:** `GET /api/pl/account_detail`
- **인증:** 불필요

**Query Parameters**

| Parameter     | Type   | 필수 | 설명        |
|---------------|--------|------|-------------|
| `base_ym`     | string | O    | 기준 연월   |
| `mgmt_acct`   | string | O    | 관리계정명  |
| `period_type` | string | X    | 기간 유형   |

**Response Body** `200 OK`

| Field            | Type   | 설명                           |
|------------------|--------|--------------------------------|
| `mgmt_acct`      | string | 관리계정                       |
| `counterparty`   | array  | 거래처별 증감 (아래 구조)      |
| `cur_vouchers`   | array  | 당기 전표 목록                 |
| `pri_vouchers`   | array  | 전기 전표 목록                 |

**counterparty 항목**

| Field    | Type   | 설명    |
|----------|--------|---------|
| `name`   | string | 거래처  |
| `cur`    | float  | 당기    |
| `pri`    | float  | 전기    |
| `change` | float  | 증감    |

**voucher 항목**

| Field         | Type   | 설명       |
|---------------|--------|------------|
| `date`        | string | 일자       |
| `voucher_no`  | string | 전표번호   |
| `counterparty`| string | 거래처     |
| `description` | string | 적요       |
| `amount`      | float  | 금액       |
| `dr_cr`       | string | 차변/대변  |

---

### 3.7 매출분석 — 거래처별

- **URL:** `GET /api/pl/sales`
- **인증:** 불필요

**Query Parameters**

| Parameter     | Type   | 필수 | 기본값 |
|---------------|--------|------|--------|
| `base_ym`     | string | O    |        |
| `period_type` | string | X    | cumulative |
| `top_n`       | int    | X    | 20     |

**Response Body** `200 OK` — `array`

| Field         | Type   | 설명     |
|---------------|--------|----------|
| `counterparty`| string | 거래처   |
| `current`     | float  | 당기     |
| `prior`       | float  | 전기     |
| `change`      | float  | 증감     |

---

### 3.8 매출 KPI

- **URL:** `GET /api/pl/sales/kpi`
- **인증:** 불필요

**Query Parameters**

| Parameter     | Type   | 필수 |
|---------------|--------|------|
| `base_ym`     | string | O    |
| `period_type` | string | X    |

**Response Body** `200 OK`

| Field                             | Type  | 설명                    |
|-----------------------------------|-------|-------------------------|
| `revenue.current`                 | float | 당기 매출               |
| `revenue.prior`                   | float | 전기 매출               |
| `revenue.change`                  | float | 증감액                  |
| `revenue.change_pct`              | float | 증감률                  |
| `revenue.vs_prev_month`           | float | 전월 대비               |
| `counterparty_count.current`      | int   | 당기 거래처 수          |
| `counterparty_count.prior`        | int   | 전기 거래처 수          |
| `counterparty_count.change`       | int   | 증감                    |
| `counterparty_count.change_pct`   | float | 증감률                  |
| `counterparty_count.vs_prev_month`| int   | 전월 대비               |

---

### 3.9 매출 월별 추이

- **URL:** `GET /api/pl/sales/trend`

**Query Parameters:** `base_ym` (필수)

**Response Body** `200 OK` — `array`

| Field     | Type  | 설명       |
|-----------|-------|------------|
| `month`   | int   | 월         |
| `current` | float | 당기 매출  |
| `prior`   | float | 전기 매출  |

---

### 3.10 매출 Top N 도넛

- **URL:** `GET /api/pl/sales/top_donut`

**Query Parameters:** `base_ym` (필수), `period_type`, `top_n` (기본 10)

**Response Body** `200 OK`

| Field       | Type    | 설명                       |
|-------------|---------|----------------------------|
| `items`     | array   | `{counterparty, amount, pct}` |
| `top_total` | float   | Top N 합계                 |
| `top_pct`   | float   | Top N 비율 (%)             |

---

### 3.11 매출 Bar Race

- **URL:** `GET /api/pl/sales/bar_race`

**Query Parameters:** `base_ym` (필수), `top_n` (기본 15)

**Response Body** `200 OK`

| Field    | Type    | 설명                                 |
|----------|---------|--------------------------------------|
| `year`   | string  | 기준 연도                            |
| `months` | int[]   | 월 목록                              |
| `data`   | array   | `{month, counterparty, amount}` 배열 |

---

### 3.12 매출 증감 Top

- **URL:** `GET /api/pl/sales/top_change`

**Query Parameters:** `base_ym` (필수), `period_type`, `top_n` (기본 10)

**Response Body** `200 OK`

| Field       | Type  | 설명                                       |
|-------------|-------|--------------------------------------------|
| `increased` | array | 증가 Top N `{counterparty, current, prior, change}` |
| `decreased` | array | 감소 Top N (동일 구조)                     |

---

### 3.13 거래처 목록 / 비교 추이

- **URL:** `GET /api/pl/sales/counterparty_list` — 거래처명 목록 반환 (`string[]`)
- **URL:** `GET /api/pl/sales/counterparty_trend` — 2개 거래처 월별 매출 비교

**counterparty_trend Query Parameters**

| Parameter | Type   | 필수 | 설명       |
|-----------|--------|------|------------|
| `base_ym` | string | O    |            |
| `cp1`     | string | X    | 거래처1    |
| `cp2`     | string | X    | 거래처2    |

**Response Body** `200 OK`

| Field      | Type  | 설명                       |
|------------|-------|----------------------------|
| `cp1`      | array | `{month, amount}` 당기     |
| `cp1_prior`| array | `{month, amount}` 전기     |
| `cp2`      | array | 동일 구조                  |
| `cp2_prior`| array | 동일 구조                  |

---

### 3.14 매출 전표 내역

- **URL:** `GET /api/pl/sales/vouchers`

**Query Parameters:** `base_ym` (필수), `period_type`

**Response Body** `200 OK`

| Field     | Type  | 설명                                                     |
|-----------|-------|----------------------------------------------------------|
| `current` | array | 당기 전표 `{date, voucher_no, counterparty, description, amount, dr_cr}` |
| `prior`   | array | 전기 전표 (동일 구조)                                    |

---

### 3.15 손익항목 상세

- **URL:** `GET /api/pl/items`

**Query Parameters:** `base_ym` (필수), `period_type`

**Response Body** `200 OK` — `array`

| Field        | Type   | 설명       |
|--------------|--------|------------|
| `account`    | string | 공시용계정 |
| `current`    | float  | 당기       |
| `prior`      | float  | 전기       |
| `change_pct` | float  | 증감률     |

---

### 3.16 손익계산서 테이블 (월/분기/연도)

- **URL:** `GET /api/pl/items/table`

**Query Parameters**

| Parameter   | Type   | 필수 | 설명                          |
|-------------|--------|------|-------------------------------|
| `base_ym`   | string | O    |                               |
| `view_type` | string | X    | `month` / `quarter` / `year`  |

**Response Body** `200 OK`

| Field     | Type     | 설명                                               |
|-----------|----------|-----------------------------------------------------|
| `columns` | string[] | 컬럼 라벨 (`["24/Q1","24/Q2",...]`)                |
| `rows`    | array    | `{type, label, values}` — type: `disclosure`/`mgmt`/`subtotal` |

---

## 4. BS 재무상태분석

### 4.1 BS Summary

- **URL:** `GET /api/bs/summary`

**Query Parameters:** `base_ym` (필수), `bs_base`

**Response Body** `200 OK` — `array`

| Field        | Type   | 설명                            |
|--------------|--------|---------------------------------|
| `category`   | string | 자산 / 부채 / 자본              |
| `sum_acct`   | string | 합산계정 (유동자산, 비유동자산 등) |
| `ending`     | float  | 기말잔액                        |
| `opening`    | float  | 기초잔액                        |
| `change_pct` | float  | 증감률                          |

---

### 4.2 BS KPI

- **URL:** `GET /api/bs/kpi`

**Query Parameters:** `base_ym` (필수)

**Response Body** `200 OK`

| Field               | Type  | 설명                    |
|---------------------|-------|-------------------------|
| `자산.ending`       | float | 기말 자산               |
| `자산.yr_start`     | float | 당기 기초               |
| `자산.yr_chg_pct`   | float | 기초 대비 증감률        |
| `자산.mo_start`     | float | 당월 기초 (전월말)      |
| `자산.mo_chg_pct`   | float | 전월말 대비 증감률      |
| `부채.*`            |       | 동일 구조               |
| `자본.*`            |       | 동일 구조               |

---

### 4.3 BS 월별 추이

- **URL:** `GET /api/bs/trend`

**Query Parameters:** `base_ym` (필수)

**Response Body** `200 OK` — `array`

| Field        | Type   | 설명       |
|--------------|--------|------------|
| `year_month` | string | 연월       |
| `자산`       | float  | 자산 기말  |
| `부채`       | float  | 부채 기말  |
| `자본`       | float  | 자본 기말  |

---

### 4.4 BS 상세 추이

- **URL:** `GET /api/bs/trend_detail`

**Query Parameters:** `base_ym` (필수)

**Response Body** `200 OK` — `array`

| Field        | Type   | 설명         |
|--------------|--------|--------------|
| `year_month` | string | 연월         |
| `유동자산`   | float  | 유동자산     |
| `비유동자산` | float  | 비유동자산   |
| `유동부채`   | float  | 유동부채     |
| `비유동부채` | float  | 비유동부채   |
| `자본`       | float  | 자본         |

---

### 4.5 BS 계정분석

- **URL:** `GET /api/bs/account`

**Query Parameters:** `base_ym` (필수), `bs_base`, `category` (선택: 자산/부채/자본)

**Response Body** `200 OK` — `array`

| Field             | Type   | 설명       |
|-------------------|--------|------------|
| `category`        | string | 분류       |
| `sum_acct`        | string | 합산계정   |
| `mgmt_acct`       | string | 관리계정   |
| `disclosure_acct` | string | 공시용계정 |
| `ending`          | float  | 기말잔액   |
| `opening`         | float  | 기초잔액   |
| `change_pct`      | float  | 증감률     |

---

### 4.6 BS 재무비율 추이

- **URL:** `GET /api/bs/ratios`

**Query Parameters:** `base_ym` (필수)

**Response Body** `200 OK` — `array`

| Field        | Type   | 설명        |
|--------------|--------|-------------|
| `year_month` | string | 연월        |
| `유동비율`   | float  | % 단위      |
| `당좌비율`   | float  | % 단위      |
| `부채비율`   | float  | % 단위      |

---

### 4.7 BS 활동성 지표 (회전일수)

- **URL:** `GET /api/bs/activity`

**Query Parameters:** `base_ym` (필수)

**Response Body** `200 OK`

| Field                 | Type   | 설명                    |
|-----------------------|--------|-------------------------|
| `current`             | object | 현재 값                 |
| `current.매출채권회전일수` | float  | 일                  |
| `current.재고자산회전일수` | float  | 일                  |
| `trend`               | array  | 월별 추이 (동일 필드)   |

---

### 4.8 BS 공시용계정 상세

- **URL:** `GET /api/bs/disclosure_detail`

**Query Parameters:** `base_ym` (필수), `disclosure_acct` (필수)

**Response Body** `200 OK`

| Field                   | Type  | 설명                                     |
|-------------------------|-------|------------------------------------------|
| `account_items`         | array | `{mgmt_acct, account_name, ending, opening}` |
| `monthly_trend`         | array | `{year_month, ending}`                   |
| `counterparty_changes`  | array | `{name, dr, cr, net}`                    |
| `vouchers`              | array | 전표 목록                                |

---

### 4.9 BS 공시용계정 목록

- **URL:** `GET /api/bs/disclosures`

**Response Body** `200 OK` — `string[]`

---

### 4.10 BS 일별 잔액

- **URL:** `GET /api/bs/daily_balance`

**Query Parameters**

| Parameter         | Type   | 필수 | 설명            |
|-------------------|--------|------|-----------------|
| `disclosure_acct` | string | O    | 공시용계정      |
| `account_name`    | string | X    | 계정과목        |
| `date_from`       | string | O    | 시작일 (YYYY-MM-DD) |
| `date_to`         | string | O    | 종료일 (YYYY-MM-DD) |

**Response Body** `200 OK` — `array`

| Field     | Type   | 설명     |
|-----------|--------|----------|
| `date`    | string | 일자     |
| `balance` | float  | 잔액     |

---

### 4.11 BS 일별 상세

- **URL:** `GET /api/bs/daily_detail`

**Query Parameters**

| Parameter         | Type   | 필수   | 설명               |
|-------------------|--------|--------|--------------------|
| `disclosure_acct` | string | O      | 공시용계정         |
| `account_name`    | string | X      | 계정과목           |
| `date`            | string | 택1    | 특정 날짜          |
| `date_from`       | string | 택1    | 기간 시작          |
| `date_to`         | string | 택1    | 기간 종료          |

**Response Body** `200 OK`

| Field              | Type  | 설명                              |
|--------------------|-------|-----------------------------------|
| `counterparty_dr`  | array | 차변 거래처 `{name, amount}`      |
| `counterparty_cr`  | array | 대변 거래처 `{name, amount}`      |
| `counter_accounts` | array | 상대계정 `{account_name, disclosure_acct, dr, cr}` |
| `vouchers`         | array | 전표 상세                         |

---

## 5. VCH 전표분석

### 5.1 전표분석 집계

- **URL:** `GET /api/vch/analysis`

**Query Parameters:** `base_ym` (필수), `period_type`

**Response Body** `200 OK` — `array`

| Field            | Type   | 설명         |
|------------------|--------|--------------|
| `disclosure_acct`| string | 공시용계정   |
| `mgmt_acct`      | string | 관리계정     |
| `dr_cr`          | string | 차변/대변    |
| `voucher_cnt`    | int    | 전표 건수    |
| `line_cnt`       | int    | 라인 수      |
| `total_amount`   | float  | 합계 금액    |

---

### 5.2 전표 검색

- **URL:** `GET /api/vch/search`

**Query Parameters**

| Parameter     | Type   | 필수 | 기본값 | 설명            |
|---------------|--------|------|--------|-----------------|
| `keyword`     | string | X    |        | 적요/거래처/전표번호 검색 |
| `disc_acct`   | string | X    |        | 공시용계정 필터  |
| `counterparty`| string | X    |        | 거래처 필터      |
| `date_from`   | string | X    |        | 시작일           |
| `date_to`     | string | X    |        | 종료일           |
| `dr_cr`       | string | X    |        | 차변/대변        |
| `page`        | int    | X    | 1      |                  |
| `page_size`   | int    | X    | 50     |                  |

**Response Body** `200 OK`

| Field       | Type  | 설명                                                        |
|-------------|-------|--------------------------------------------------------------|
| `total`     | int   | 전체 건수                                                   |
| `page`      | int   | 현재 페이지                                                 |
| `page_size` | int   | 페이지 크기                                                 |
| `items`     | array | `{date, voucher_no, dr_cr, amount, counterparty, description, account_name, disclosure_acct, mgmt_acct}` |

---

### 5.3 전표번호 상세

- **URL:** `GET /api/vch/voucher_detail`

**Query Parameters:** `voucher_no` (필수)

**Response Body** `200 OK` — `array`

| Field             | Type   | 설명       |
|-------------------|--------|------------|
| `date`            | string | 일자       |
| `voucher_no`      | string | 전표번호   |
| `account_name`    | string | 계정과목   |
| `disclosure_acct` | string | 공시용계정 |
| `mgmt_acct`       | string | 관리계정   |
| `counterparty`    | string | 거래처     |
| `description`     | string | 적요       |
| `dr_cr`           | string | 차변/대변  |
| `amount`          | float  | 금액       |

---

### 5.4 전표 KPI

- **URL:** `GET /api/vch/kpi`

**Query Parameters:** `base_ym` (필수), `period_type`, `disc_accts` (쉼표 구분), `date`

**Response Body** `200 OK`

| Field       | Type  | 설명           |
|-------------|-------|----------------|
| `total_cnt` | int   | 전체 전표 건수 |
| `dr_sum`    | float | 차변 합계      |
| `cr_sum`    | float | 대변 합계      |

---

### 5.5 일자별 전표 건수

- **URL:** `GET /api/vch/daily`

**Query Parameters:** `base_ym` (필수), `period_type`, `disc_accts`

**Response Body** `200 OK` — `array`

| Field  | Type   | 설명     |
|--------|--------|----------|
| `date` | string | 일자     |
| `cnt`  | int    | 전표 건수 |

---

### 5.6 계정별 전표 건수

- **URL:** `GET /api/vch/account_bar`

**Query Parameters:** `base_ym` (필수), `period_type`, `disc_accts`, `date`

**Response Body** `200 OK` — `array`

| Field             | Type   | 설명       |
|-------------------|--------|------------|
| `disclosure_acct` | string | 공시용계정 |
| `cnt`             | int    | 건수       |

---

### 5.7 상위 거래처

- **URL:** `GET /api/vch/top_counterparty`

**Query Parameters:** `base_ym` (필수), `period_type`, `disc_accts`, `date`, `top_n` (기본 10)

**Response Body** `200 OK` — `array`

| Field  | Type   | 설명     |
|--------|--------|----------|
| `name` | string | 거래처   |
| `cnt`  | int    | 건수     |
| `pct`  | float  | 비율 (%) |

---

### 5.8 기표내역 (페이지네이션)

- **URL:** `GET /api/vch/vouchers`

**Query Parameters:** `base_ym` (필수), `period_type`, `disc_accts`, `date`, `page`, `page_size` (기본 100)

**Response Body** — 5.2 전표 검색과 동일한 페이지네이션 구조

---

### 5.9 상대계정 집계 / 라인

- **URL:** `GET /api/vch/counter_summary` — 검색 결과의 전표번호 기준 전체 계정 집계
- **URL:** `GET /api/vch/counter_lines` — 선택 계정의 전표 상세 라인

**counter_summary Response** — `array`

| Field             | Type   | 설명       |
|-------------------|--------|------------|
| `account_name`    | string | 계정과목   |
| `disclosure_acct` | string | 공시용계정 |
| `dr`              | float  | 차변 합계  |
| `cr`              | float  | 대변 합계  |

---

## 6. Scenario 시나리오분석

### 공통 시나리오 전표 항목 구조

| Field           | Type   | 설명        |
|-----------------|--------|-------------|
| `date`          | string | 일자        |
| `voucher_no`    | string | 전표번호    |
| `account_name`  | string | 계정과목    |
| `counterparty`  | string | 거래처      |
| `description`   | string | 적요        |
| `amount`        | float  | 금액        |
| `dr_cr`         | string | 차변/대변   |

### 6.1 SC1 — 동일금액 중복 전표

| Endpoint | Method | 설명 |
|----------|--------|------|
| `/api/scenario/1/detail` | GET | 레거시 상세 (`base_ym`) |
| `/api/scenario/1/exceptions` | GET | 예외 그룹 (`date_from`, `date_to`, `min_amount`, `max_amount`) |
| `/api/scenario/1/extract` | GET | 선택 그룹 전표 추출 (`date_from`, `date_to`, `year_month`, `account_name`, `amount`) |
| `/api/scenario/1/lines` | GET | 선택 그룹 전표 라인 (동일 파라미터) |

**exceptions Response 항목**

| Field          | Type   | 설명     |
|----------------|--------|----------|
| `year_month`   | string | 연월     |
| `account_name` | string | 계정과목 |
| `amount`       | float  | 금액     |
| `dr_cnt`       | int    | 차변 건수 |
| `cr_cnt`       | int    | 대변 건수 |
| `total_cnt`    | int    | 총 건수  |

---

### 6.2 SC2 — 현금지급 후 부채인식

| Endpoint | Method | 설명 |
|----------|--------|------|
| `/api/scenario/2/detail` | GET | 레거시 상세 (`base_ym`) |
| `/api/scenario/2/exceptions` | GET | 예외 그룹 (`date_from`, `date_to`, `min_amount`, `max_amount`) |
| `/api/scenario/2/extract` | GET | 선택 그룹 추출 (`date_from`, `date_to`, `year_month`, `amount`) |
| `/api/scenario/2/lines` | GET | 선택 그룹 전표 라인 (동일 파라미터) |

---

### 6.3 SC3 — 주말 현금지급

| Endpoint | Method | 설명 |
|----------|--------|------|
| `/api/scenario/3/detail` | GET | 레거시 상세 (`base_ym`) |
| `/api/scenario/3/summary` | GET | 일별 집계 차트용 (`date_from`, `date_to`) |
| `/api/scenario/3/extract` | GET | 선택 날짜 전표 (`date_from`, `date_to`, `selected_date`) |

**summary Response 항목**

| Field          | Type   | 설명       |
|----------------|--------|------------|
| `date`         | string | 일자       |
| `cnt`          | int    | 건수       |
| `total_amount` | float  | 합계 금액  |

---

### 6.4 SC4 — 고액 현금지급

| Endpoint | Method | 설명 |
|----------|--------|------|
| `/api/scenario/4/detail` | GET | 레거시 상세 (`base_ym`, `threshold` 기본 1,000,000) |
| `/api/scenario/4/summary` | GET | 일별 집계 (`date_from`, `date_to`, `min_amount`, `max_amount`) |
| `/api/scenario/4/extract` | GET | 선택 날짜 전표 (`date_from`, `date_to`, `selected_date`, `min_amount`, `max_amount`) |

---

### 6.5 SC5 — 비용+현금 동시기표

| Endpoint | Method | 설명 |
|----------|--------|------|
| `/api/scenario/5/detail` | GET | 레거시 상세 (`base_ym`) |
| `/api/scenario/5/summary` | GET | 일별 집계 (`date_from`, `date_to`) |
| `/api/scenario/5/extract` | GET | 선택 날짜별 전표별 비용/현금 집계 (`date_from`, `date_to`, `selected_date`) |

**extract Response 항목**

| Field            | Type   | 설명       |
|------------------|--------|------------|
| `voucher_no`     | string | 전표번호   |
| `expense_amount` | float  | 비용 금액  |
| `cash_amount`    | float  | 현금 금액  |

---

### 6.6 SC6 — 희소 거래처

| Endpoint | Method | 설명 |
|----------|--------|------|
| `/api/scenario/6/detail` | GET | 레거시 상세 (`base_ym`, `threshold` 기본 10) |
| `/api/scenario/6/exceptions` | GET | 희소 거래처 목록 (`date_from`, `date_to`, `threshold`) |
| `/api/scenario/6/extract` | GET | 선택 거래처 전표 (`date_from`, `date_to`, `counterparty`) |

**exceptions Response 항목**

| Field         | Type   | 설명       |
|---------------|--------|------------|
| `counterparty`| string | 거래처     |
| `vch_cnt`     | int    | 전표 건수  |

**extract Response 항목**

| Field       | Type   | 설명       |
|-------------|--------|------------|
| `date`      | string | 일자       |
| `voucher_no`| string | 전표번호   |
| `dr_amount` | float  | 차변 금액  |
| `cr_amount` | float  | 대변 금액  |

---

## 7. 문의게시판 (Inquiry)

### 7.1 문의 목록 조회

- **URL:** `GET /api/inquiry`
- **인증:** 불필요

**Response Body** `200 OK` — `array`

| Field         | Type   | 설명                                             |
|---------------|--------|--------------------------------------------------|
| `id`          | int    | 문의 ID                                          |
| `category`    | string | 카테고리 (`Comment`, `조회 오류`, `데이터 오류`, `기타 문의`) |
| `title`       | string | 제목                                             |
| `author`      | string | 작성자                                           |
| `corporation` | string | 법인명                                           |
| `is_secret`   | bool   | 비밀글 여부                                      |
| `status`      | string | 상태 (`답변대기` / `답변완료`)                   |
| `created_at`  | string | 작성일 (`YYYY-MM-DD HH:MM`)                     |

---

### 7.2 문의 작성

- **URL:** `POST /api/inquiry`
- **인증:** 불필요

**Request Body**

| Field         | Type   | 필수 | 기본값     | 설명          |
|---------------|--------|------|------------|---------------|
| `category`    | string | X    | `기타 문의` | 카테고리      |
| `title`       | string | O    |            | 제목          |
| `content`     | string | O    |            | 내용          |
| `author`      | string | O    |            | 작성자        |
| `corporation` | string | X    | null       | 법인명        |
| `is_secret`   | bool   | X    | false      | 비밀글 여부   |

```json
{
  "category": "데이터 오류",
  "title": "매출 데이터 누락",
  "content": "2025-09월 A 거래처 매출이 누락되어 있습니다.",
  "author": "홍길동",
  "corporation": "삼성",
  "is_secret": false
}
```

**Response Body** `201 Created`

```json
{ "id": 5 }
```

---

### 7.3 문의 상세 조회

- **URL:** `GET /api/inquiry/{inquiry_id}`
- **인증:** 불필요

**Response Body** `200 OK`

| Field         | Type        | 설명           |
|---------------|-------------|----------------|
| `id`          | int         | 문의 ID        |
| `category`    | string      | 카테고리       |
| `title`       | string      | 제목           |
| `content`     | string      | 내용           |
| `author`      | string      | 작성자         |
| `corporation` | string      | 법인명         |
| `is_secret`   | bool        | 비밀글 여부    |
| `status`      | string      | 상태           |
| `reply`       | string\|null| 관리자 답변    |
| `reply_at`    | string\|null| 답변 일시      |
| `created_at`  | string      | 작성일         |

---

### 7.4 문의 수정

- **URL:** `PATCH /api/inquiry/{inquiry_id}`
- **인증:** 불필요

**Request Body** (모든 필드 선택적)

| Field         | Type   | 설명          |
|---------------|--------|---------------|
| `category`    | string | 카테고리      |
| `title`       | string | 제목          |
| `content`     | string | 내용          |
| `corporation` | string | 법인명        |
| `is_secret`   | bool   | 비밀글 여부   |

**Response Body** `200 OK`

```json
{ "ok": true }
```

---

### 7.5 관리자 답변

- **URL:** `POST /api/inquiry/{inquiry_id}/reply`
- **인증:** 불필요

**Request Body**

| Field   | Type   | 필수 | 설명      |
|---------|--------|------|-----------|
| `reply` | string | O    | 답변 내용 |

```json
{ "reply": "확인 후 데이터 보정 완료하였습니다." }
```

**Response Body** `200 OK`

```json
{ "ok": true }
```

---

### 7.6 문의 삭제

- **URL:** `DELETE /api/inquiry/{inquiry_id}`
- **인증:** 불필요

**Response Body** `200 OK`

```json
{ "ok": true }
```

---

## 8. 자료요청 (Requests)

### 8.1 요청 목록 조회

- **URL:** `GET /api/requests`
- **인증:** 불필요

**Response Body** `200 OK` — `array`

| Field         | Type   | 설명                                      |
|---------------|--------|-------------------------------------------|
| `id`          | int    | 요청 ID                                   |
| `reqCode`     | string | 요청 코드 (`REQ-001`)                     |
| `title`       | string | 제목                                      |
| `entity`      | string | 법인명                                    |
| `assignee`    | string | 담당자 (쉼표 구분)                        |
| `requester`   | string | 요청자                                    |
| `status`      | string | 상태 (`Draft`, `초안`, `submitted`, `completed`) |
| `priority`    | string | 우선순위 (`높음`, `보통`, `낮음`)         |
| `dueDate`     | string | 마감일                                    |
| `createdDate` | string | 생성일 (`YYYY-MM-DD`)                    |
| `description` | string | 설명                                      |

---

### 8.2 요청 일괄 생성

- **URL:** `POST /api/requests`
- **인증:** 불필요

**Request Body** — `RequestCreate[]` (배열)

| Field         | Type   | 필수 | 기본값  | 설명       |
|---------------|--------|------|---------|------------|
| `title`       | string | O    |         | 제목       |
| `entity`      | string | O    |         | 법인명     |
| `assignee`    | string | O    |         | 담당자     |
| `requester`   | string | O    |         | 요청자     |
| `status`      | string | X    | `Draft` | 상태       |
| `priority`    | string | X    | `보통`  | 우선순위   |
| `due_date`    | string | X    | `""`    | 마감일     |
| `description` | string | X    | `""`    | 설명       |

```json
[
  {
    "title": "3월 세금계산서",
    "entity": "삼성전자",
    "assignee": "김철수",
    "requester": "관리자",
    "due_date": "2025-04-15",
    "priority": "높음"
  }
]
```

**Response Body** `201 Created`

```json
{ "ids": [1, 2] }
```

---

### 8.3 요청 수정

- **URL:** `PATCH /api/requests/{req_id}`
- **인증:** 불필요

**Request Body** (모든 필드 선택적)

| Field         | Type   | 설명       |
|---------------|--------|------------|
| `title`       | string | 제목       |
| `entity`      | string | 법인명     |
| `assignee`    | string | 담당자     |
| `requester`   | string | 요청자     |
| `status`      | string | 상태       |
| `priority`    | string | 우선순위   |
| `due_date`    | string | 마감일     |
| `description` | string | 설명       |

**Response Body** `200 OK` — 8.1의 단일 요청 객체와 동일

---

### 8.4 요청 상태 변경

- **URL:** `PATCH /api/requests/{req_id}/status`
- **인증:** 불필요

**Request Body**

| Field    | Type   | 필수 | 설명     |
|----------|--------|------|----------|
| `status` | string | O    | 새 상태  |

```json
{ "status": "submitted" }
```

**Response Body** `200 OK`

```json
{ "ok": true }
```

---

### 8.5 요청 삭제

- **URL:** `DELETE /api/requests/{req_id}`
- **인증:** 불필요

**Response Body** `200 OK`

```json
{ "ok": true }
```

---

### 8.6 파일 목록 조회

- **URL:** `GET /api/requests/{req_id}/files`
- **인증:** 불필요

**Response Body** `200 OK` — `array`

| Field          | Type   | 설명                              |
|----------------|--------|-----------------------------------|
| `id`           | int    | 파일 ID                           |
| `requestId`    | int    | 요청 ID                           |
| `filename`     | string | 저장 파일명 (UUID)                |
| `originalName` | string | 원본 파일명                       |
| `uploader`     | string | 업로더                            |
| `size`         | int    | 파일 크기 (bytes)                 |
| `uploadedAt`   | string | 업로드 일시                       |
| `url`          | string | 다운로드 경로 (`/media/requests/...`) |

---

### 8.7 파일 업로드

- **URL:** `POST /api/requests/{req_id}/files`
- **인증:** 불필요
- **Content-Type:** `multipart/form-data`

**Request Body**

| Field      | Type        | 필수 | 설명       |
|------------|-------------|------|------------|
| `file`     | File        | O    | 업로드 파일 |
| `uploader` | string      | X    | 업로더 이름 |

**Response Body** `201 Created` — 8.6의 단일 파일 객체와 동일

---

### 8.8 파일 삭제

- **URL:** `DELETE /api/requests/{req_id}/files/{file_id}`
- **인증:** 불필요

**Response Body** `200 OK`

```json
{ "ok": true }
```

---

## 10. 김삼일 AI 챗봇 (Chat)

### 10.1 채팅 메시지 전송

- **URL:** `POST /api/chat/message`
- **인증:** 불필요
- **설명:** 김삼일 AI 매니저에게 질문을 보내고 답변을 받습니다. 현재 보고 있는 페이지와 필터 정보를 함께 전달하면 컨텍스트 인식 답변을 제공합니다.

**Request Header**

| Header         | Type   | 필수 | 설명                             |
|----------------|--------|------|----------------------------------|
| `Content-Type` | string | O    | `application/json`               |

**Request Body**

| Field         | Type        | 필수 | 기본값       | 설명                                    |
|---------------|-------------|------|--------------|-----------------------------------------|
| `message`     | string      | O    |              | 사용자 질문 내용                        |
| `base_ym`     | string      | X    | `2025-09`    | 기준 연월 (`YYYY-MM`)                   |
| `period_type` | string      | X    | `cumulative` | `monthly` / `cumulative`                |
| `page`        | string      | X    | null         | 현재 페이지 ID (아래 표 참조)           |
| `history`     | ChatMessage[] | X  | null         | 이전 대화 기록 (최근 10개까지 사용)     |

**ChatMessage 구조**

| Field  | Type   | 설명                    |
|--------|--------|-------------------------|
| `role` | string | `user` / `assistant`    |
| `text` | string | 메시지 내용             |

**page 값 목록**

| page 값         | 페이지 이름            |
|-----------------|------------------------|
| `summary`       | Summary 대시보드       |
| `pl-sum`        | PL 요약                |
| `pl-trend`      | PL 추이분석            |
| `pl-acct`       | PL 계정분석            |
| `pl-sale`       | 매출분석               |
| `pl-item`       | 손익항목               |
| `bs-sum`        | BS 요약                |
| `bs-trend`      | BS 추이분석            |
| `bs-acct`       | BS 계정분석            |
| `vch-analysis`  | 전표분석               |
| `vch-search`    | 전표검색               |
| `sc-dup`        | SC1 중복전표           |
| `sc-cash-debt`  | SC2 현금→부채          |
| `sc-weekend`    | SC3 주말현금           |
| `sc-big-cash`   | SC4 고액현금           |
| `sc-cost-cash`  | SC5 비용+현금          |
| `sc-seldom`     | SC6 희소거래처         |

**Request 예시**

```json
{
  "message": "이번 달 매출 이상한 점 있어?",
  "base_ym": "2025-09",
  "period_type": "cumulative",
  "page": "pl-sum",
  "history": [
    { "role": "user", "text": "안녕하세요" },
    { "role": "assistant", "text": "안녕하세요! 김삼일입니다. 무엇을 도와드릴까요?" }
  ]
}
```

**Response Body** `200 OK`

| Field   | Type   | 설명                |
|---------|--------|---------------------|
| `reply` | string | 김삼일 AI 답변 내용 |

```json
{
  "reply": "2025년 9월 누적 매출액은 5,230,000원으로 전년 동기 대비 19.1% 증가했습니다.\n\n다만 주요 거래처 중 A사 매출이 전년 대비 40% 급감했으니 확인이 필요합니다.\n\n추가로 SC1 시나리오에서 중복 전표 3건이 발견되었으니 점검을 권장드립니다."
}
```

**에러 응답**

| Status | 조건                          | Body                                                      |
|--------|-------------------------------|------------------------------------------------------------|
| 422    | message 누락                  | `{"detail": [{"loc": ["body","message"], "msg": "..."}]}`  |
| 500    | GenAI API 연결 실패           | `{"detail": "Internal Server Error"}`                      |

### 10.2 사용 가능한 AI 도구 (Function Calling)

김삼일 AI는 사용자 질문에 따라 아래 도구를 자동으로 호출하여 DB에서 실시간 데이터를 조회합니다.

| Tool 이름            | 설명                                              | 주요 파라미터               |
|----------------------|---------------------------------------------------|-----------------------------|
| `get_kpi`            | 매출액, 영업이익 KPI 지표 조회                    | `base_ym`, `period_type`    |
| `get_pl_summary`     | PL 요약 (당기/전기 전 항목)                       | `base_ym`, `period_type`    |
| `get_pl_sales_top`   | 거래처별 매출 순위                                | `base_ym`, `period_type`, `top_n` |
| `get_pl_items`       | 손익항목 상세 (공시용계정별)                      | `base_ym`, `period_type`    |
| `get_bs_summary`     | BS 요약 (자산/부채/자본 기말/기초)                | `base_ym`                   |
| `get_bs_ratios`      | 재무비율 (유동비율, 부채비율)                     | `base_ym`                   |
| `get_indicators`     | 재무 지표 (이익률, 유동비율 등)                   | `base_ym`, `period_type`    |
| `get_scenario_count` | SC1~SC6 시나리오 이상 전표 건수                   | `base_ym`                   |
| `get_scenario_detail`| 특정 시나리오 이상 전표 상세 내역                 | `base_ym`, `scenario_num`   |
| `get_top3_changes`   | 매출 거래처/비용 계정/자산/부채 증감 Top3         | `base_ym`, `period_type`    |

### 10.3 김삼일 페르소나

| 항목      | 설명                                                    |
|-----------|---------------------------------------------------------|
| 이름      | 김삼일                                                  |
| 소속      | 삼일회계법인 매니저                                     |
| 성격      | 전문적이면서 친근한 말투 (존댓말)                       |
| 전문분야  | 회계/재무분석, 이상 전표 탐지, 재무비율 분석            |
| 답변 스타일 | 핵심 먼저 → 부연설명, bullet point, 숫자에 단위 표기  |

---

## 11. Admin 인증

### 11.1 관리자 로그인

- **URL:** `POST /api/auth/login`
- **인증:** 불필요

**Request Body**

| Field      | Type   | 필수 | 설명       |
|------------|--------|------|------------|
| `email`    | string | O    | 이메일     |
| `password` | string | O    | 비밀번호   |

```json
{ "email": "admin@pwc.com", "password": "admin123!" }
```

**Response Body** `200 OK`

| Field          | Type   | 설명               |
|----------------|--------|--------------------|
| `access_token` | string | JWT 토큰           |
| `token_type`   | string | `bearer`           |
| `user`         | object | 사용자 정보 (아래) |

**user 구조**

| Field          | Type   | 설명            |
|----------------|--------|-----------------|
| `id`           | int    | 사용자 ID       |
| `email`        | string | 이메일          |
| `name`         | string | 이름            |
| `company`      | string | 소속 회사       |
| `role`         | string | 역할            |
| `group_id`     | int    | 그룹 ID         |
| `status`       | string | 상태            |
| `trust_level`  | string | 신뢰 등급       |
| `two_fa`       | bool   | 2FA 여부        |

**에러 응답**

| Status | Body                                                  |
|--------|-------------------------------------------------------|
| 401    | `{"detail": "이메일 또는 비밀번호가 올바르지 않습니다."}` |

---

### 11.2 로그아웃

- **URL:** `POST /api/auth/logout`

**Response Body** `200 OK` — `{"message": "로그아웃되었습니다."}`

---

### 11.3 현재 사용자 조회

- **URL:** `GET /api/auth/me`
- **인증:** 필요

**Response Body** `200 OK` — 9.1의 user 구조와 동일

---

## 12. Admin 사용자 관리

> 모든 엔드포인트 인증 필요 (Bearer Token)

### 12.1 사용자 목록

- **URL:** `GET /api/users`

**Query Parameters:** `search`, `company`, `role`, `status` (모두 선택)

**Response Body** `200 OK`

```json
{ "users": [UserResponse, ...], "total": 10 }
```

**UserResponse 구조**

| Field             | Type        | 설명            |
|-------------------|-------------|-----------------|
| `id`              | int         | ID              |
| `email`           | string      | 이메일          |
| `name`            | string      | 이름            |
| `company`         | string      | 회사            |
| `group_id`        | int\|null   | 그룹 ID         |
| `role`            | string      | 역할            |
| `status`          | string      | 상태            |
| `trust_level`     | string      | 신뢰 등급       |
| `two_fa`          | bool        | 2FA             |
| `password_expiry` | string\|null| 비밀번호 만료일 |
| `last_login`      | string\|null| 마지막 로그인   |
| `created_at`      | string\|null| 생성일          |

---

### 12.2 사용자 생성

- **URL:** `POST /api/users`

**Request Body**

| Field      | Type        | 필수 | 기본값   |
|------------|-------------|------|----------|
| `email`    | string      | O    |          |
| `name`     | string      | O    |          |
| `company`  | string      | O    |          |
| `group_id` | int\|null   | X    | null     |
| `role`     | string      | X    | `viewer` |
| `password` | string\|null| X    | null     |

**Response Body** `201 Created` — UserResponse

---

### 12.3 사용자 상세 / 수정 / 삭제

| Endpoint                        | Method | 설명             |
|---------------------------------|--------|------------------|
| `/api/users/{user_id}`          | GET    | 상세 조회        |
| `/api/users/{user_id}`          | PUT    | 수정             |
| `/api/users/{user_id}`          | DELETE | 삭제             |
| `/api/users/{user_id}/reset-password` | POST | 비밀번호 초기화 |
| `/api/users/{user_id}/toggle-status`  | POST | 상태 토글       |

---

## 13. Admin 그룹 관리

| Endpoint                  | Method | 설명     |
|---------------------------|--------|----------|
| `/api/groups`             | GET    | 목록     |
| `/api/groups`             | POST   | 생성     |
| `/api/groups/{group_id}`  | PUT    | 수정     |

**GroupCreate Request Body**

| Field          | Type   | 필수 | 기본값   |
|----------------|--------|------|----------|
| `name`         | string | O    |          |
| `company`      | string | O    |          |
| `default_role` | string | X    | `viewer` |

**Group Response 구조**

| Field          | Type        | 설명       |
|----------------|-------------|------------|
| `id`           | int         | 그룹 ID    |
| `name`         | string      | 그룹명     |
| `company`      | string      | 회사       |
| `default_role` | string      | 기본 역할  |
| `report_count` | int         | 리포트 수  |
| `member_count` | int         | 멤버 수    |
| `created_at`   | string\|null| 생성일     |

---

## 14. Admin 권한 관리

| Endpoint                  | Method | 설명                   |
|---------------------------|--------|------------------------|
| `/api/permissions/matrix` | GET    | 리포트 권한 매트릭스   |
| `/api/permissions/matrix` | PUT    | 리포트 권한 수정       |
| `/api/permissions/detail` | GET    | 사용자별 개별 권한     |
| `/api/permissions/detail` | PUT    | 사용자별 권한 수정     |

**리포트 권한 항목**

| Field          | Type   | 설명         |
|----------------|--------|--------------|
| `id`           | int    | 권한 ID      |
| `report_name`  | string | 리포트명     |
| `role`         | string | 역할         |
| `can_view`     | bool   | 보기         |
| `can_download` | bool   | 다운로드     |
| `can_print`    | bool   | 인쇄         |
| `can_share`    | bool   | 공유         |
| `can_comment`  | bool   | 댓글         |

**사용자 권한 항목**

| Field              | Type   | 설명           |
|--------------------|--------|----------------|
| `user_id`          | int    | 사용자 ID      |
| `can_view_report`  | bool   | 리포트 보기    |
| `can_upload`       | bool   | 업로드         |
| `can_pdf`          | bool   | PDF            |
| `can_excel`        | bool   | Excel          |
| `can_print`        | bool   | 인쇄           |
| `can_share`        | bool   | 공유           |
| `can_comment`      | bool   | 댓글           |
| `can_request_user` | bool   | 사용자 추가 요청 |

---

## 15. Admin 역할 관리

| Endpoint               | Method | 설명   |
|------------------------|--------|--------|
| `/api/roles`           | GET    | 목록   |
| `/api/roles`           | POST   | 생성   |
| `/api/roles/{role_id}` | PUT    | 수정   |
| `/api/roles/{role_id}` | DELETE | 삭제   |

**RoleCreate Request Body**

| Field         | Type     | 필수 | 설명                        |
|---------------|----------|------|-----------------------------|
| `name`        | string   | O    | 역할명                      |
| `category`    | string   | O    | `pwc` / `client`            |
| `description` | string   | X    | 설명                        |
| `permissions` | string[] | X    | 권한 목록 (기본 `[]`)       |

**Role Response 구조**

| Field         | Type        | 설명       |
|---------------|-------------|------------|
| `id`          | int         | 역할 ID    |
| `name`        | string      | 역할명     |
| `category`    | string      | 카테고리   |
| `description` | string\|null| 설명       |
| `permissions` | string[]    | 권한 목록  |
| `created_at`  | string\|null| 생성일     |

---

## 16. Admin 활동 로그

| Endpoint              | Method | 설명     |
|-----------------------|--------|----------|
| `/api/audit-logs`     | GET    | 로그 목록 (페이지네이션) |
| `/api/audit-logs/stats` | GET  | 로그 통계 |

**목록 Query Parameters:** `action_type`, `actor`, `search`, `page` (기본 1), `page_size` (기본 10)

**Log 항목 구조**

| Field         | Type        | 설명       |
|---------------|-------------|------------|
| `id`          | int         | 로그 ID    |
| `timestamp`   | string\|null| 발생 시각  |
| `actor`       | string      | 수행자     |
| `action_type` | string      | 활동 유형  |
| `detail`      | string      | 상세       |
| `target`      | string      | 대상       |
| `ip_address`  | string      | IP         |

---

## 17. Admin 보안

| Endpoint                       | Method | 설명               |
|--------------------------------|--------|--------------------|
| `/api/security/accounts`       | GET    | 계정 상태 현황     |
| `/api/security/login-failures` | GET    | 로그인 실패 통계   |
| `/api/security/stats`          | GET    | 보안 대시보드 통계 |

**보안 통계 Response**

| Field               | Type | 설명               |
|---------------------|------|--------------------|
| `total_users`       | int  | 전체 사용자 수     |
| `active_users`      | int  | 활성 사용자 수     |
| `two_fa_enabled`    | int  | 2FA 활성화 수      |
| `expired_passwords` | int  | 만료 비밀번호 수   |

---

## 18. Admin 회사 관리

| Endpoint                       | Method | 설명         |
|--------------------------------|--------|--------------|
| `/api/companies`               | GET    | 회사 목록    |
| `/api/companies`               | POST   | 회사 생성    |
| `/api/companies/subsidiaries`  | POST   | 자회사 생성  |
| `/api/companies/names`         | GET    | 회사명 목록  |

**CompanyCreate:** `{ "name": "삼성전자" }`

**SubsidiaryCreate:** `{ "name": "삼성SDS", "company_id": 1 }`

---

## 19. Admin 사용자 추가 요청

| Endpoint                                | Method | 설명     |
|-----------------------------------------|--------|----------|
| `/api/admin/requests`                   | GET    | 목록     |
| `/api/admin/requests`                   | POST   | 생성     |
| `/api/admin/requests/{request_id}/approve` | PUT | 승인     |
| `/api/admin/requests/{request_id}/reject`  | PUT | 반려     |

**RequestCreate**

| Field          | Type   | 필수 | 설명      |
|----------------|--------|------|-----------|
| `target_name`  | string | O    | 대상 이름 |
| `target_email` | string | O    | 대상 이메일 |
| `reason`       | string | X    | 사유      |

---

## ERD 기반 권한 매트릭스

### 메뉴별 접근 권한

| 메뉴                | uploader | viewer | viewer_uploader | admin |
|---------------------|:--------:|:------:|:---------------:|:-----:|
| 서비스 소개         | O        | O      | O               | O     |
| 리포트              | X        | O      | O               | O     |
| 자료실 (자료 요청)  | O        | X      | O               | O     |
| 문의게시판          | O        | O      | O               | O     |
| 권한 관리           | X        | X      | X               | O     |

### 자료실 기능별 권한

| 기능                              | 유저 (uploader)    | 관리자 (admin)     |
|-----------------------------------|--------------------|--------------------|
| 법인명·담당자·요청일·마감일·상태  | View only          | Edit only          |
| 제출 히스토리                     | View only          | View only          |
| 댓글                              | View only          | Create/Read/Update |
| 파일 업로드                       | CRUD               | CRUD               |
| 리마인더 발송                     | X                  | O                  |
