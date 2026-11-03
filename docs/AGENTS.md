# 에이전트 분담

업무 성격별로 7개. 한 번에 최대 3개까지만 동시에 돌린다. 마일스톤마다 커밋하고, `TODO(decision)`은 마일스톤 끝에 모아서 보고한다.

| # | 에이전트 | 담당 | 마일스톤 | 선행 조건 |
|---|---|---|---|---|
| 1 | 기반 | pnpm workspaces, tsup, vitest, eslint, `core/types.ts`, `core/codec.ts`, 상수 파일 뼈대, 빈 웹 Vercel 배포 | M0 | 없음 |
| 2 | 분석 엔진 | parsers, metrics, scoring, redact, analyze 명령, fixtures | M1 | 1 |
| 3 | 웹 | `/`, `/start`, `/t/{TYPE}`, `/types`, hash 디코딩과 fallback, 게이지, 카드 PNG, Web Share, 유형별 HTML 빌드, vercel.json | M2, M5, M6 | 1 |
| 4 | 픽셀 아트 | 팔레트 확정, 베이스 1종, 샘플 3종, 나머지 13종, 소품 아이콘 | M3, M6 | SPEC 10장 |
| 5 | 렌더러 | 터미널 ANSI 반블록 렌더러와 fallback, 웹 canvas 애니메이션 | M3 | 1, 4 샘플 |
| 6 | 스킬·CLI UX | SKILL.md, install, render 검증과 재시도, run, 브라우저 열기, 터미널 레이아웃 | M4 | 2, 5, 7 |
| 7 | 콘텐츠 | typeMeta 16종 이름·소개·궁합, 라이트 모드 템플릿 16개, SKILL.md 톤 규칙 문단 | M4, M6 | SPEC 8장, 10장 |

## 진행 순서

```
1 기반 ──┬── 2 분석 엔진 ──────────┬── 6 스킬·CLI ── 검수 ── publish
         ├── 3 웹 ─────────────────┤
         └── 4 픽셀(3종) ── 5 렌더러 ┘
                 7 콘텐츠 (2·3과 병렬, 코드 의존 없음)
         4 픽셀(13종) ── 3 웹 도감 (M6)
```

## 작업 규칙

- 실제 로그 파일(`~/.claude`, `~/.zsh_history`)은 포맷 확인용으로만 읽는다. 레포에는 `fixtures/`의 가짜 로그만 커밋한다.
- 픽셀 데이터와 콘텐츠는 데이터 파일(json)로만 산출한다. 코드 에이전트가 가져다 쓴다.
- 한글 문구는 SPEC 8장의 톤 규칙을 따른다.
- 커밋 메시지는 `feat(core): ...`, `feat(web): ...`, `chore: ...` 형식. 마일스톤 완료 커밋은 본문에 `M0 done` 처럼 표기.
