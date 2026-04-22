# EasyView ERD

```mermaid
erDiagram

    COMPANY {
        int     id              PK
        string  name            "회사 이름 (required)"
        string  subsidiary_name "자회사 이름 (required)"
        date    biz_start       "업 기간 시작 (optional)"
        date    biz_end         "업 기간 끝 (optional)"
        string  country         "국가 (optional)"
        string  company_type    "타입 (optional)"
        date    contract_start  "계약 기간 시작 (optional)"
        date    contract_end    "계약 기간 끝 (optional)"
        string  base_currency   "기준 통화 원 (optional)"
        string  base_period     "기준 분기 (optional)"
        datetime created_at
        datetime updated_at
    }

    USER {
        int     id              PK
        int     company_id      FK
        string  name_kr         "이름 (한)"
        string  name_en         "이름 (영)"
        string  email           UK
        string  password_hash
        enum    role            "uploader | viewer | viewer_uploader | admin"
        enum    status          "active | inactive | pending"
        datetime created_at
        datetime updated_at
    }

    REPORT {
        int     id          PK
        int     company_id  FK
        string  title
        string  period      "YYYY-QN 등"
        datetime created_at
        datetime updated_at
    }

    REPORT_COMMENT {
        int     id          PK
        int     report_id   FK
        int     author_id   FK
        string  page_label  "리포트 내 위치"
        text    content
        datetime created_at
        datetime updated_at
    }

    RESOURCE_REQUEST {
        int     id                  PK
        int     company_id          FK  "법인명"
        int     requester_id        FK  "자료요청자 (관리자)"
        int     company_manager_id  FK  "법인담당자 (유저)"
        date    request_date        "요청일"
        date    deadline            "마감일"
        string  month               "YYYY-MM (월별 일괄용)"
        enum    status              "draft | submitted | completed"
        datetime created_at
        datetime updated_at
    }

    RESOURCE_FILE {
        int     id          PK
        int     request_id  FK
        string  file_name
        string  file_path
        int     uploaded_by FK
        datetime uploaded_at
    }

    SUBMISSION_HISTORY {
        int     id          PK
        int     request_id  FK
        enum    status      "draft | submitted | completed"
        int     changed_by  FK
        string  note
        datetime changed_at
    }

    RESOURCE_COMMENT {
        int     id          PK
        int     request_id  FK
        int     author_id   FK  "관리자만 작성"
        text    content
        datetime created_at
        datetime updated_at
    }

    REMINDER {
        int     id          PK
        int     request_id  FK
        int     sent_by     FK  "관리자만"
        datetime sent_at
    }

    INQUIRY {
        int     id          PK
        int     author_id   FK
        enum    category    "report_comment | error | permission | contract | etc"
        string  title
        text    content
        datetime created_at
        datetime updated_at
        datetime deleted_at "soft delete"
    }

    INQUIRY_COMMENT {
        int     id          PK
        int     inquiry_id  FK
        int     author_id   FK
        text    content
        datetime created_at
        datetime updated_at
        datetime deleted_at "soft delete"
    }

    %% ── Relations ──

    COMPANY     ||--o{  USER                : "소속"
    COMPANY     ||--o{  REPORT              : "보유"
    COMPANY     ||--o{  RESOURCE_REQUEST    : "대상 법인"

    USER        }o--||  COMPANY             : "belongs to"
    USER        ||--o{  RESOURCE_REQUEST    : "요청 (requester)"
    USER        ||--o{  RESOURCE_REQUEST    : "담당 (company_manager)"
    USER        ||--o{  RESOURCE_FILE       : "업로드"
    USER        ||--o{  SUBMISSION_HISTORY  : "상태 변경"
    USER        ||--o{  RESOURCE_COMMENT    : "댓글 작성"
    USER        ||--o{  REMINDER            : "발송"
    USER        ||--o{  REPORT_COMMENT      : "코멘트"
    USER        ||--o{  INQUIRY             : "게시"
    USER        ||--o{  INQUIRY_COMMENT     : "댓글"

    REPORT      ||--o{  REPORT_COMMENT      : "has"

    RESOURCE_REQUEST ||--o{ RESOURCE_FILE       : "첨부 파일"
    RESOURCE_REQUEST ||--o{ SUBMISSION_HISTORY  : "제출 이력"
    RESOURCE_REQUEST ||--o{ RESOURCE_COMMENT    : "관리자 댓글"
    RESOURCE_REQUEST ||--o{ REMINDER            : "리마인더"

    INQUIRY     ||--o{  INQUIRY_COMMENT     : "댓글"
```

## 권한별 메뉴 접근

| 메뉴            | uploader | viewer | viewer_uploader | admin |
|---------------|:--------:|:------:|:---------------:|:-----:|
| 서비스 소개      | O        | O      | O               | O     |
| 리포트          | X        | O      | O               | O     |
| 자료실(자료 요청) | O        | X      | O               | O     |
| 문의게시판       | O        | O      | O               | O     |
| 권한 관리        | X        | X      | X               | O     |

## 자료실 기능별 권한

| 기능                        | 유저      | 관리자    |
|----------------------------|-----------|-----------|
| 법인명·담당자·요청일·마감일·상태 | View only | Edit only |
| 제출 히스토리               | View only | View only |
| 댓글 (관리자 소통)           | Edit only | CRU       |
| 파일 업로드 (여러 개)        | CRUD      | CRUD      |
| 리마인더 발송               | X         | O         |

## 문의게시판 기능별 권한

| 카테고리            | 유저                  | 관리자                |
|--------------------|----------------------|----------------------|
| Report Comment     | 게시 CRU / 댓글 CRU   | 게시 CRUD / 댓글 CRUD |
| 오류 문의           | 게시 CRU / 댓글 CRU   | 게시 CRUD / 댓글 CRUD |
| 기타               | 게시 CRU / 댓글 CRU   | 게시 CRUD / 댓글 CRUD |
| 사용자추가/권한요청  | 게시 CRU / 댓글 CRU   | 게시 CRUD / 댓글 CRUD |
| 계약 문의           | 게시 CRU / 댓글 CRU   | 게시 CRUD / 댓글 CRUD |
```
