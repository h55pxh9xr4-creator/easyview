# 멀티 자회사 리포트 아키텍처 — 진단 및 개선안

> **팀 공유용 문서** · 회의 안건 · 의사결정 요청
>
> 작성일: 2026-04-26 · 작성자: (본인) · 분류: Architecture / Backend / Frontend

---

## 0. TL;DR (한 줄 요약)

- 현재 리포트 시스템은 **"단일 활성 리포트"** 가정으로 설계되어 있음.
- 풀무원처럼 **본사 1 + 자회사 N (베트남법인·중국법인 …)** 구조에서 **N개 리포트가 동시에 보여야 한다**는 요구사항을 구조적으로 만족하지 못함.
- 새 리포트를 활성화해도 이전 리포트(예: ABC 샘플) 데이터가 화면에 그대로 표시되는 현상은 위 한계의 **표면 증상**.
- 본질 해결은 **백엔드 view 폐기 + 명시적 `report_id` 필터링 + 자회사 선택 UI**이며, **5~8일 규모 작업**.
- 단기 미봉책(Phase 1)으로 같은 (회사·기간) 조합의 구버전만 archive하도록 1줄 수정 가능하지만, 다중 자회사 동시 표시는 구조 변경이 필수.

---

## 1. 현재 발견된 문제 (재현 시나리오)

### 1.1 증상
1. 관리자가 ABC 샘플 리포트를 활성화 → ABC 데이터가 모든 페이지에 표시됨 ✅ 정상
2. 풀무원식품 JE/TB 업로드 → 리포트 생성 → 발송(활성화) → status `active`, `is_active=1`
3. **여전히 ABC 데이터가 보임** OR **숫자가 모두 0으로 표시**

### 1.2 데이터 관점에서는 정상
풀무원 JE 173,723건, TB 236건은 **백엔드 파서가 정확히 적재**함을 시뮬레이션으로 확인했습니다 (9월 누적 매출액 약 469억 등 실제 값 산출). 즉 **데이터 적재는 정상이며, 표시 단계의 라우팅 문제**.

### 1.3 백엔드 view 정의 (`backend/main.py`)
```sql
CREATE VIEW je AS
SELECT j.* FROM je_data j
WHERE j.report_id = COALESCE(
    (SELECT id FROM reports WHERE is_active = 1 LIMIT 1),     -- ① 활성 리포트 우선
    (SELECT id FROM reports
     WHERE status IN ('active','reviewing','generated')
     ORDER BY id DESC LIMIT 1)                                -- ② fallback: 최근 generated
)
```
**모든 분석 쿼리(PL/BS/VCH/SC)는 이 단일 view를 통과**하며, 사용자·회사·자회사 컨텍스트가 view에 전혀 반영되지 않음.

### 1.4 활성화 로직의 모순 (`backend/routers/admin_reports.py`)
```python
elif body.status == "active":
    db.query(Report).filter(
        Report.company == report.company,    # ← 같은 회사명만
        Report.is_active == True,
        Report.id != report_id,
    ).update({"is_active": False, "status": "archived"})
    report.is_active = True
```
- 활성화 로직은 **"같은 회사 내 중복 active 방지"** 의도 (멀티 회사 동시 active 허용)
- 하지만 view는 **"전체 active 중 LIMIT 1"** 으로 단일만 선택
- **둘이 일관성 없음** → 풀무원 active + ABC active 상황에서 view는 임의로 하나만 보임 (보통 id 작은 것)

---

## 2. 요구되는 최종 아키텍처

### 2.1 비즈니스 요구사항 (확정)
- **1 회사(고객사) → N 자회사(대상법인)** 계층
- 본사 담당자: **본사 산하 모든 자회사** 리포트 열람 가능
- Viewer: **관리자가 지정한 자회사만** 열람 가능
- 한 시점에 **여러 자회사 리포트가 동시 활성** 가능
- 사용자는 **현재 보는 자회사를 선택**하여 페이지 데이터 전환

### 2.2 기술적 함의
| 영역 | 현재 | 필요 |
|---|---|---|
| 활성 리포트 수 | 1개 (글로벌) | N개 (자회사별 1개) |
| 데이터 라우팅 | DB view 단일 | 사용자 선택 + 권한 체크 |
| 권한 모델 | (사실상) 없음 | 사용자 ↔ 자회사 매핑 |
| 프론트 페이지 컨텍스트 | 무관 | "현재 자회사" 세션 상태 |

---

## 3. 현재 구조의 한계 (왜 패치만으로 안 되는가)

### 3.1 백엔드 view는 파라미터를 못 받음
SQLite/Postgres `CREATE VIEW`는 정적 SQL로, 사용자·세션 컨텍스트를 받을 수 없음. 즉 view 자체가 단일 리포트 가정의 산물이며, **멀티 active를 지원하려면 view를 폐기해야 함**.

### 3.2 모든 분석 쿼리가 view에 의존
대상 라우터:
- `routers/summary.py` — KPI, Top3, 지표, PL/BS 테이블, 시나리오 카운트
- `routers/pl.py` — PL 요약/추이/계정/매출/손익항목
- `routers/bs.py` — BS 요약/추이/계정/일별잔액
- `routers/vch.py` — 전표 분석/검색/일별/거래처
- `routers/scenario.py` — SC1~SC6

대략 **30개 이상의 엔드포인트**가 view를 직접 또는 간접 사용. 모두 `report_id` 필터로 재작성 필요.

### 3.3 프론트엔드도 회사 컨텍스트를 모름
- `useFilter` 스토어: `baseYm`, `periodType`, `compareTarget`, `bsBase`, `amountUnit`, `currency` 만 관리
- "현재 보는 자회사" 상태가 **존재하지 않음**
- 사이드바·헤더에 자회사 선택 UI 없음

### 3.4 권한 체크 미적용
- `admin_models.py`에 `ReportPermission`, `UserPermission` 테이블은 있음
- 하지만 분석 쿼리에서 **권한 체크하는 곳이 없음** → 모든 사용자가 모든 데이터에 접근 가능 (현재는 view가 한 개만 노출하므로 문제가 표면화 안 됨)

---

## 4. 의사결정이 필요한 사항

> 팀 회의에서 합의 필요. 옵션별 trade-off 표기.

### D1. **자회사 선택 단위**
- (a) 단일 선택: 한 번에 한 자회사만 표시 (드롭다운으로 전환)
  - ✅ 단순 / 기존 화면 그대로
  - ❌ 본사 담당자가 비교 시 불편
- (b) 다중 선택 + 합산(연결): 여러 자회사 합쳐 보여주기
  - ✅ 본사 담당자 편의
  - ❌ 통화·계정체계 차이로 합산 의미 모호 / 별도 연결재무제표 페이지 필요
- **추천: (a) 단일 선택을 1차 구현, 합산 페이지는 별도 프로젝트로 분리**

### D2. **권한 모델**
- (a) `user_subsidiary_permissions` 테이블 신설: 사용자 ↔ 자회사 N:N
- (b) 기존 `ReportPermission` 활용: report 단위 권한 (자회사 = report.company)
- (c) 역할 기반: admin/manager → 본사 산하 전체, viewer → 명시 매핑된 것만
- **추천: (c) 역할 + 명시 매핑 보조** (구현 단순)

### D3. **리포트 활성화 단위**
- (a) (회사, 기간) 단위 단일 active — 같은 자회사·같은 월의 신버전 발송 시 구버전 archive
- (b) (회사) 단위 단일 active — 자회사별 가장 최근 1개
- **추천: (a)** — 기간별 이력 추적 가능

### D4. **자회사 선택 UI 위치**
- (a) Header 우측 (현재 사용자 메뉴 옆에 자회사 셀렉터)
- (b) 사이드바 상단 (리포트 메뉴 위)
- (c) FilterBar 첫 항목 (기간/기준연월과 같은 라인)
- **추천: (a) Header** — 모든 페이지에서 보이며 페이지 변경과 무관

### D5. **프론트→백엔드 컨텍스트 전달 방식**
- (a) 매 요청에 `?report_id=X` 쿼리 파라미터
- (b) HTTP 헤더 `X-Report-Id: X`
- (c) 서버 세션 (사용자가 자회사 선택 시 서버 측 상태 갱신)
- **추천: (a)** — RESTful, 캐싱 친화적, 디버깅 쉬움

### D6. **연결재무제표(다중 합산) 별도 처리?**
- 본사 담당자가 "전체 합산" 보고 싶을 때
- 환율 변환·계정 매핑·내부거래 제거 등 본격 회계 로직 필요
- **결정 보류 / 별도 프로젝트로 분리 권장**

### D7. **기존 데이터 마이그레이션**
- 현재 ABC 샘플로 구성된 단일 active 환경 → 멀티 자회사 환경으로 전환
- (a) 기존 ABC report.company를 "ABC 샘플 자회사"로 두고 그대로 유지
- (b) 마이그레이션 스크립트로 회사 ↔ 자회사 분리
- **추천: (a)** — 점진 전환

---

## 5. 단계별 구현 로드맵

### Phase 1 — 데이터 구조 정비 (백엔드, 0.5~1일)
**목표**: 멀티 active 허용 + 활성화 정책 정상화
- [ ] `admin_reports.py` 활성화 로직: `(company, period)` 조합의 구버전만 archive (`Report.period == report.period` 조건 추가)
- [ ] 새 테이블 검토: `subsidiary` (자회사 마스터), `user_subsidiary_access` (권한 매핑) 등 — 또는 기존 `companies/company_subsidiaries` 활용
- [ ] `reports.company` 의미 명확화 (자회사명? 본사명?) — 문서화

**Phase 1만으론 화면 표시 불변**. 인프라 정비.

### Phase 2 — 백엔드 쿼리 리팩토링 (백엔드, 2~3일)
**목표**: view 폐기, 모든 쿼리가 명시적 `report_id` 사용
- [ ] DB view `je`, `tb_account` DROP
- [ ] 모든 라우터에 `report_id` 쿼리 파라미터 추가
- [ ] 권한 체크 미들웨어 (사용자가 해당 report 접근 권한 있는지)
- [ ] 단위 테스트 보강 (회귀 방지)

**완료 시점에서 백엔드는 멀티 자회사 지원 완성**.

### Phase 3 — 프론트엔드 자회사 컨텍스트 (프론트, 1~2일)
**목표**: 자회사 선택 UI + API 호출에 `report_id` 자동 첨부
- [ ] `useReport` Zustand 스토어 신설 (current_subsidiary, available_subsidiaries, current_report_id)
- [ ] Header에 자회사 선택 드롭다운 추가
- [ ] `lib/api.ts` 모든 fetch 함수에 `report_id` 자동 첨부 (axios interceptor 패턴)
- [ ] 자회사 변경 시 모든 페이지 데이터 재조회 (React Query라면 invalidate)

### Phase 4 — 권한 UI (관리자 페이지, 1일)
**목표**: 관리자가 사용자별 자회사 권한 지정
- [ ] `admin/accounts` 페이지에 "허용 자회사" 다중 선택 UI
- [ ] Viewer 사용자는 본인 권한 자회사 목록만 드롭다운에 노출

### Phase 5 — 회귀 테스트 + 마이그레이션 (0.5~1일)
- [ ] 기존 ABC 단일 활성 시나리오 정상 동작 확인
- [ ] 다중 자회사 동시 활성 시나리오 검증
- [ ] Viewer 권한 제한 검증
- [ ] 운영 DB 마이그레이션 스크립트

**총 합계: 5~8일** (1인 기준).

---

## 6. 당장 할 수 있는 일 (Quick Wins)

> Phase 2/3 본 작업 전에도 즉시 적용 가능한 부분 수정.

### Q1. 활성화 로직 즉시 보정 — **5분**
```python
# admin_reports.py L406~410
db.query(Report).filter(
    Report.company == report.company,
    Report.period == report.period,        # ← 이 한 줄 추가
    Report.is_active == True,
    Report.id != report_id,
).update({"is_active": False, "status": "archived"})
```
**효과**: 같은 자회사·같은 기간의 신버전 발송 시 구버전 자동 archive. 다른 자회사는 살아있음.
**한계**: view는 여전히 LIMIT 1이라 한 화면에 1개만 보임. 자회사 선택 UI 없으면 사용자 효용 ZERO.

### Q2. 임시 우회 — DB 직접 수정 — **즉시**
지금 ABC와 풀무원이 둘 다 active라 ABC가 우선 보이는 경우, 로컬 DB에서:
```sql
UPDATE reports SET is_active = 0, status = 'archived'
WHERE id != <풀무원 리포트 id> AND is_active = 1;
```
풀무원 단독 active로 만들면 화면에 풀무원 데이터 즉시 노출.
**한계**: 정책이 아닌 임시 우회. ABC 다시 보려면 수동으로 active 토글.

### Q3. 진단 로깅 — **30분**
`_run_generate` 끝에 적재 통계 print 추가:
```python
session.add(AuditLog(
    actor=actor,
    action_type="리포트 생성 완료",
    detail=f"리포트 #{report_id} JE {len(out)}건, TB {len(df_tb)}건 적재",
    target=report.title,
))
```
향후 어떤 파일이 적재 단계에서 누락되는지 추적 가능.

### Q4. 자회사 마스터 데이터 점검 — **반나절**
- `companies` 테이블 실제 행 수, `company_subsidiaries` 매핑 상태 확인
- 풀무원식품 본사 + 베트남법인/중국법인 등 자회사 등록 누락 점검
- 누락이라면 시드 데이터로 채워두기 (Phase 4 사전 작업)

---

## 7. 리스크 / 운영 영향

| 리스크 | 영향 | 완화 |
|---|---|---|
| Phase 2 view 폐기 시 일부 쿼리 누락 → 데이터 안 보임 | 🔴 높음 | 페이지별 회귀 테스트, 점진 마이그레이션 |
| 권한 체크 누락 시 정보 노출 | 🔴 높음 | 모든 라우터 미들웨어 강제 |
| 프론트 자회사 변경 시 페이지 캐시 stale | 🟡 중간 | 변경 이벤트로 전체 invalidate |
| 기존 ABC 단일 시나리오 회귀 | 🟡 중간 | 호환 모드 옵션, 단계적 출시 |
| 본 작업 중 팀원 PR과 충돌 | 🟡 중간 | 큰 변경은 feature 브랜치 + 짧은 회의 동기화 |
| 환율 변환·통화 단위가 자회사별 다름 | 🟢 낮음 (기존 글로벌 필터로 처리됨) | 자회사별 default 통화 옵션 추후 |

---

## 8. 회의 안건 정리 (그대로 가져갈 것)

### 결정 항목 (8가지)
- [ ] **D1**: 자회사 선택 단위 — 단일 / 다중 합산 / 둘 다
- [ ] **D2**: 권한 모델 — 새 테이블 / 기존 활용 / 역할 기반
- [ ] **D3**: 활성화 단위 — (회사·기간) / (회사)
- [ ] **D4**: 자회사 선택 UI 위치 — Header / Sidebar / FilterBar
- [ ] **D5**: 컨텍스트 전달 방식 — 쿼리 파라미터 / 헤더 / 세션
- [ ] **D6**: 연결재무제표 별도 프로젝트 분리 여부
- [ ] **D7**: 기존 ABC 데이터 처리 방식
- [ ] **담당자 분배**: Phase별 (백엔드/프론트/QA)

### 즉시 결정 가능한 것
- [ ] **Q1 (활성화 로직 1줄 수정)** 적용 여부 — 다음 리포트 발송 전까지

### 일정 합의
- [ ] Phase 1 시작일 / 완료 목표일
- [ ] Phase 2/3 병렬 진행 가능 여부
- [ ] 베타 테스트 자회사 (예: 풀무원만 먼저)
- [ ] 정식 배포 마일스톤

---

## 9. 첨부 자료

- 본 문서: `docs/multi-tenant-architecture.md`
- 관련 문서: `docs/project-overview.html` (전체 프로젝트 구조)
- 관련 코드:
  - 활성화 로직: `backend/routers/admin_reports.py` L401~412
  - View 정의: `backend/main.py` L120~155
  - Report 모델: `backend/admin_models.py` L118~135
  - 분석 라우터: `backend/routers/{summary,pl,bs,vch,scenario}.py`

---

> **이 문서는 팀 합의 전 초안입니다. 회의 후 결정사항을 본문에 반영하여 v2로 업데이트해주세요.**
