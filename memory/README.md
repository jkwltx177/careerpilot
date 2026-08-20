# memory/ — 구조와 작성 규칙

> Claude가 세션마다 로드하는 정본 메모리. **메모리 1개 = 파일 1개**, `MEMORY.md`는 한 줄 포인터만 쌓는 인덱스다.
> (MEMORY.md 안의 안내는 HTML 주석이라 GitHub 프리뷰에 안 보인다 — 이 문서가 렌더링용 정본.)
>
> 용어: **도씨에(dossier)** = 한 주제(프로젝트·경력)의 검증된 사실만 모아 둔 근거 파일. 자소서·면접 답변의 모든 수치·주장은 도씨에에 근거해야 한다는 것이 이 체계의 제1원칙이다.

## 폴더 구조 (템플릿 원작자가 실제 캠페인 한 시즌을 운영하며 정착시킨 구조 — 처음부터 이렇게 시작하면 좋다)

```
memory/
├── MEMORY.md                      # 인덱스 (섹션별 한 줄 포인터)
├── README.md                      # 이 문서
├── <이름>-profile-facts.md        # 프로필 사실 매핑 (type: user)
├── job-applications-<시즌>.md     # 캠페인 연대기 — append-only 히스토리 로그 (type: project)
├── companies/                     # ★ 회사별 폴더 — 지원하는 회사마다 하나
│   └── <회사명>/
│       └── status.md              # "현재 상태" 페이지: 지금 어느 단계·다음 마감·확정 사실·액션
├── projects/                      # 프로젝트·경험 도씨에 (자소서·면접 답변의 근거 원장)
│   └── <대표프로젝트>-deepdive.md  # 아키텍처·지표·본인 역할·설계 근거 (type: project)
└── rules/                         # 작업 원칙 — 실수에서 얻은 교훈을 규칙으로 박제 (type: feedback)
    └── fact-verification-rules.md # 예: "후기·수치는 작성 시점 확인" 같은 검증 원칙
```

## 운용 원칙

1. **연대기 vs 현재 상태의 이원화** — 연대기(`job-applications-*`)는 지우지 말고 쌓기만 한다(append-only). "이 회사 지금 어느 단계인가"는 `companies/<회사>/status.md`가 정본 — 세션 시작 때 Claude가 이것부터 읽게 된다.
2. **status.md는 짧게** — 트랙 상태 한 줄 + 확정 일정([확정]/[예상]/[미확인] 표기) + 다음 액션 2~3개 + 관련 문서 링크. 감시 중인 회사라면 **직전 스윕 결과 1줄**도 — `openings-sweep`이 다음 회차의 baseline으로 읽는다. 히스토리·경위가 궁금하면 연대기로 링크(`[[슬러그]]`). 형식 예시: `companies/_example/status.md` (실사용 시작하면 삭제).
3. **rules/는 실수가 날 때마다 자란다** — "왜 틀렸고 다음에 어떻게 하는가"를 **Why:** / **How to apply:** 로 박제. 같은 실수를 두 번 하지 않는 것이 이 폴더의 존재 이유다.

## 메모리 파일 형식

각 파일 상단 frontmatter:

```markdown
---
name: short-kebab-case-slug
description: 한 줄 요약 — 회상 시 관련성 판단에 쓰임
metadata:
  type: user | feedback | project | reference
---

본문. feedback/project는 **Why:** 와 **How to apply:** 를 붙인다.
관련 메모리는 [[슬러그]]로 링크.
```

`MEMORY.md` 인덱스 줄 형식:

```markdown
- [제목](경로/파일명.md) — 한 줄 요약(훅)
```

## 권장 시작 도씨에 (첫 세션에서 Claude에게 만들어 달라고 할 것)

- `<이름>-profile-facts.md` — 프로젝트·수상·레포 매핑 (type: user)
- `projects/<대표프로젝트>-deepdive.md` — 주력 프로젝트 완전 기술 도씨에 (type: project)
- `rules/fact-verification-rules.md` — 정보 검증 원칙 (type: feedback)
- `job-applications-<시즌>.md` — 지원 캠페인 연대기 (type: project)
