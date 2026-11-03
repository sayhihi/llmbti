# llmbti, 기획서 (Claude Code 구현용)

> **이 문서를 받은 Claude Code에게**
> - 이 문서가 구현의 기준이야. 여기 없는 결정은 임의로 확장하지 말고 `TODO(decision):` 주석으로 남긴 뒤 마일스톤 끝에 모아서 물어봐.
> - 마일스톤(M0~M6) 단위로 작업하고, 마일스톤마다 커밋해. 각 마일스톤의 완료 조건을 만족해야 다음으로 넘어가.
> - `⚙️ 튜닝 대상`이라고 표시된 수치는 초기값이야. 상수 파일 한 곳에 모아 둬.
> - 에이전트 분담은 `docs/AGENTS.md`를 본다.

변경 이력
- 2026-11-03: 이름을 폴더명대로 llmbit로 잡았다가 2026-11-04 `llmbti`로 최종 확정(LLM + MBTI). 아래 본문은 전부 llmbti 기준. 웹 페이지 구조를 3페이지로 재편. 캐릭터 컨셉을 "버그 16종"에서 "Claude 마스코트 베이스"로 변경. 셸 히스토리 기본값은 동의 후 ON으로 확정.

---

## 1. 한 줄 요약

LLM(Claude Code)에게 일을 시키는 패턴과 셸 명령 히스토리를 분석해서, 개발자의 MBTI를 **픽셀 캐릭터**와 **개발 유머 디스**로 보여주는 사이드프로젝트.

- 슬로건: `$ npx llmbti` → `ENFP  // 브랜치 23개, 머지 0개` (2026-11-04 변경, 원안은 `> typeof me`)
- 실행: `npx llmbti`
- 웹: `llmbti.vercel.app`
- 슬래시 명령: `/llmbti`

## 2. 핵심 원칙

1. **서버 없음.** 웹은 Vercel 정적 배포만 쓴다. API, DB, 서버리스 함수 없음.
2. **원본 로그는 기기 밖으로 나가지 않는다.** 웹으로 가는 건 결과(유형, 점수, 일부 통계, 문구)뿐이고, URL hash에 실어 보낸다. hash는 서버로 전송되지 않는다.
3. **유형 판정은 결정적이다.** 점수와 유형은 스크립트가 계산한다. 같은 입력이면 항상 같은 결과가 나와야 한다. LLM은 문구만 쓴다.
4. **웃겨야 한다.** 근거(실제 숫자)가 있는 디스가 기본 톤이다. 근거 없는 칭찬은 쓰지 않는다.
5. **캐릭터는 Claude 마스코트 실루엣을 베이스로 쓴다.** 그 외 기존 IP 캐릭터는 쓰지 않는다. 10장 참고.

## 3. 사용자 플로우

```
[터미널 / 로컬]
 1. npx llmbti install        → ~/.claude/skills/llmbti/ 에 스킬 설치
 2. Claude Code에서 /llmbti
 3. analyze 스크립트            → 로그 집계 + 4축 점수 + 유형 + 샘플(마스킹)
 4. Claude가 문구 JSON 작성      → 스키마 검증
 5. render 스크립트             → 터미널에 픽셀 캐릭터 + 요약 + 결과 URL, 브라우저 열기

[브라우저 / Vercel 정적]
 6. 공유 페이지                 → 캐릭터(애니메이션), 축 게이지, 문구, 통계 배지
 7. 공유                       → 링크 복사 / Web Share / 카드 PNG 다운로드
 8. 친구가 링크 열기 → "나도 해보기" → /start → 1번으로
```

**라이트 모드 (스킬 없이):** `npx llmbti`만 실행하면 Claude 없이 3 → 템플릿 문구 → 5로 진행한다. Claude Code를 안 쓰는 사람도 셸 히스토리만으로 결과를 받을 수 있다. 결과 페이지에는 "Claude가 쓴 버전은 더 맵다" CTA를 노출한다.

## 4. 레포 구조

pnpm workspaces 모노레포.

```
llmbti/
├─ docs/                  # SPEC.md, AGENTS.md
├─ packages/
│  ├─ core/              # 공유 로직 (런타임 의존성 0)
│  │  ├─ src/types.ts        # Stats, Scores, MbtiType, ResultPayload, CopyJson
│  │  ├─ src/codec.ts        # payload ↔ URL hash (deflate-raw + base64url)
│  │  ├─ src/palette.ts      # 공통 16색 팔레트
│  │  ├─ src/characters/     # 16종 픽셀 데이터 (*.json)
│  │  └─ src/typeMeta.ts     # 유형별 이름, 캐릭터, 한 줄 소개, 궁합
│  └─ cli/               # npm 패키지 "llmbti" (bin: llmbti)
│     ├─ src/commands/{install,analyze,render,run}.ts
│     ├─ src/parsers/{claudeHistory,claudeProjects,zsh,bash}.ts
│     ├─ src/metrics/        # 시그널 계산
│     ├─ src/scoring.ts      # 4축 점수 + 유형 판정
│     ├─ src/scoring.constants.ts
│     ├─ src/redact.ts       # 시크릿 마스킹
│     ├─ src/templates/      # 라이트 모드용 템플릿 문구
│     └─ src/terminal/       # ANSI 픽셀 렌더러
├─ skill/
│  └─ SKILL.md            # install 시 ~/.claude/skills/llmbti/ 로 복사
├─ apps/web/              # Vite + React + TS, 정적 빌드
└─ fixtures/              # 테스트용 가짜 로그 (실제 로그 커밋 금지)
```

- CLI는 tsup으로 core까지 번들한다. 런타임 의존성은 0을 목표로 하고, Node 18 이상의 내장 모듈만 쓴다.
- `.gitignore`에 `*.jsonl`, `*_history`를 넣되 `fixtures/`만 예외로 둔다.

## 5. 데이터 소스

| 소스 | 경로 | 용도 | 기본값 |
|---|---|---|---|
| Claude Code 프롬프트 히스토리 | `~/.claude/history.jsonl` | 프롬프트 텍스트, 시간 | ON |
| Claude Code 세션 로그 | `~/.claude/projects/*/*.jsonl` | 세션당 턴 수, tool_use(Bash 명령, TodoWrite 등), 인터럽트 | ON |
| zsh 히스토리 | `$HISTFILE` 또는 `~/.zsh_history` | 셸 명령 | 동의 후 ON |
| bash 히스토리 | `~/.bash_history` | 셸 명령 | 동의 후 ON |

**파서 요구사항**
- 포맷이 버전마다 다를 수 있으므로 **방어적으로 파싱**한다. 모르는 필드는 무시하고, 깨진 줄은 건너뛰고 건너뛴 개수를 센다.
- 세션 로그에서는 `type: "user"`인 사람 입력만 프롬프트로 센다. tool_result나 시스템 메시지는 프롬프트에서 제외한다. 서브에이전트(sidechain) 로그는 제외한다.
- zsh extended history 포맷(`: 1699999999:0;command`)과 멀티라인 명령을 처리한다.
- Windows 경로(`%USERPROFILE%\.claude`)를 지원한다.
- 분석 기간 기본값은 최근 30일이다(`--days`로 변경 가능). Claude Code 로그는 기본 보관 기간이 짧을 수 있으므로, 데이터가 적으면 결과에 "표본 적음" 배지를 단다.
- **최소 표본:** 프롬프트 30개 미만이고 셸 명령 200개 미만이면 판정 대신 "아직 덜 컴파일됨" 화면을 보여준다. ⚙️ 튜닝 대상

## 6. 분석: 시그널 → 4축

각 축 점수는 -100..+100이다. 양수면 앞 글자(E, S, T, J)다.
축 점수 = Σ(가중치 × 시그널 정규화값). 시그널 정규화값은 `clamp((x - 기준값) / 스케일, -1, 1)`로 구한다. 기준값, 스케일, 가중치는 모두 `scoring.constants.ts`에 둔다. ⚙️ 튜닝 대상

### E / I, 대화형 vs 독백형
| 시그널 | 방향 | 초기 기준값 |
|---|---|---|
| 세션당 평균 사람 턴 수 | 높으면 E | 8 |
| 물음표로 끝나는 프롬프트 비율 | 높으면 E | 25% |
| 프롬프트 평균 길이(자) | 길면 I | 120 |
| 인터럽트/끼어들기 비율("잠깐", "아니", "stop", 중단 이벤트) | 높으면 E | 10% |

### S / N, 구체 vs 추상
| 시그널 | 방향 | 초기 기준값 |
|---|---|---|
| 파일 경로·라인 번호·코드블록·스택트레이스가 포함된 프롬프트 비율 | 높으면 S | 30% |
| 추상 키워드 비율("구조", "설계", "아키텍처", "깔끔하게", "개선", "refactor", "design", "better") | 높으면 N | 15% |
| 에러 로그 붙여넣기 비율 | 높으면 S | 10% |

### T / F, 건조 vs 다정
| 시그널 | 방향 | 초기 기준값 |
|---|---|---|
| 감사·사과·감정 표현 비율("고마워", "감사", "미안", "ㅋㅋ", "ㅠ", "thanks", "please", 이모지) | 높으면 F | 10% |
| 20자 이하 명령형 프롬프트 비율("고쳐", "해줘", "다시") | 높으면 T | 30% |

### J / P, 계획형 vs 즉흥형
| 시그널 | 방향 | 초기 기준값 |
|---|---|---|
| 계획 신호(TodoWrite 사용, "계획", "plan", "단계", plan 모드) 비율 | 높으면 J | 10% |
| 테스트 실행 비율(Bash/셸에서 `test`, `jest`, `vitest`, `pytest`, `go test`) | 높으면 J | 5% |
| `--force`, `-f` push, `reset --hard`, `rm -rf` 빈도 | 높으면 P | 1% |
| 방향 전환 비율("다시", "취소", "아니 그게 아니라", "되돌려") | 높으면 P | 10% |
| 커밋 메시지가 `fix`, `wip`, `.`, `asdf` 같은 저품질인 비율 | 높으면 P | 20% |

- **동점 처리:** |점수| < 5이면 해당 축을 "경계형"으로 표시하고(예: `EN?P`), 판정은 부호대로 한다. 0이면 앞 글자로 판정한다.
- 셸 히스토리가 없으면 해당 시그널을 빼고 가중치를 재정규화한다.

### 재미용 통계 (축 점수에는 쓰지 않고 문구와 배지에만 사용)
- 가장 활발한 시간대, 새벽 2~5시 활동 비율
- `--force` 횟수, `rm -rf` 횟수, `sudo !!` 횟수
- 많이 친 셸 명령 top 5(인자 제외, 명령어만)
- 가장 짧은 프롬프트, 가장 많이 반복한 프롬프트
- "다시" 횟수, "고마워" 횟수
- 최장 세션 길이(턴 수), 가장 많이 쓴 Claude 툴

## 7. 프라이버시와 마스킹

- analyze가 출력하는 JSON에는 **집계 통계 + 샘플 프롬프트 최대 20개**만 담는다.
- 샘플은 120자로 자르고 `redact.ts`를 통과시킨다. 마스킹 대상:
  - API 키와 토큰 패턴(`sk-`, `ghp_`, `xox[bp]-`, `AKIA`, JWT, 32자 이상 hex/base64 덩어리)
  - 이메일, 전화번호, URL의 userinfo와 쿼리스트링, IP
  - `password=`, `token=`, `secret=` 뒤의 값
  - 홈 디렉터리 경로 → `~`
- 샘플 선정 기준: 가장 짧은 것, 가장 많이 반복된 것, 새벽 시간대, 방향 전환 키워드 포함, 감정 표현 포함. 웃길 확률이 높은 것 위주로 고른다.
- **결과 페이로드(URL)에는 샘플 원문을 넣지 않는다.** Claude가 쓴 문구 안에 들어간 인용만 허용하고, 그 문구도 render 단계에서 redact를 한 번 더 통과시킨다.
- 스킬은 셸 히스토리를 읽기 전에 사용자에게 동의를 받는다. 기본값은 동의 후 ON.

## 8. 문구 (Claude가 작성)

### CopyJson 스키마
```ts
type CopyJson = {
  lang: "ko" | "en";
  nickname: string;       // 한 줄 별명, ≤ 20자. 예: "프로덕션 직배포 메뚜기"
  roast: string;          // 디스 본문, 2~3문장, ≤ 200자
  evidence: string[];     // 정확히 3개, 각 ≤ 60자, 반드시 실제 숫자 포함
  commitMessage: string;  // "오늘의 커밋 메시지", ≤ 50자. 예: "fix: fix the fix"
  pairWith: { type: MbtiType; reason: string }; // 페어 프로그래밍 궁합, reason ≤ 40자
};
```
- render는 스키마와 길이를 검증하고, 실패하면 에러 메시지를 출력한다. 스킬은 그 에러를 보고 Claude가 다시 쓰게 한다(최대 2회).
- 톤 규칙(SKILL.md에 포함): 근거 숫자 필수, 개발 밈 활용, 비하가 아니라 놀리는 수준, 외모·성별·나이 같은 개인 속성은 언급 금지, 회사명·프로젝트 경로 노출 금지.
- 한글 문구 공통 규칙: 담백한 구어체, 괄호 최소, 가운뎃점과 줄표 같은 특수문자 금지, 버즈워드 금지. 프로덕션은 "prd"로 쓴다.

### 라이트 모드 템플릿
`templates/{type}.ko.json`에 유형별로 nickname, roast 템플릿 3개, commitMessage 5개를 둔다. evidence는 통계에서 규칙 기반으로 상위 3개를 뽑아 `"{count}번 --force push"` 같은 슬롯 문장으로 채운다. 시드는 통계 해시로 정해서 결과가 결정적으로 나오게 한다.

## 9. 결과 페이로드와 URL

```ts
type ResultPayload = {
  v: 1;
  type: MbtiType;
  scores: { EI: number; SN: number; TF: number; JP: number }; // 정수
  badges: string[];       // 통계 배지 키, 최대 6개. 예: "nightOwl", "forcePusher"
  stats: Record<string, number>; // 배지 표시에 필요한 숫자만
  copy: CopyJson;
  mode: "claude" | "lite";
  periodDays: number;
  sampleSize: { prompts: number; shell: number };
};
```
- 인코딩: `JSON → deflate-raw → base64url`. Node는 `zlib`, 브라우저는 `DecompressionStream('deflate-raw')`를 써서 의존성 없이 처리한다.
- **URL 형식:** `https://llmbti.vercel.app/t/{TYPE}#r={payload}`
  - path의 `/t/ENFP`는 크롤러가 읽는 유형별 정적 페이지라서, 유형별 OG 이미지가 뜬다.
  - hash에는 개인 결과가 담기고 서버로 전송되지 않는다.
- 디코딩에 실패하거나 버전이 다르면 해당 유형의 일반 소개 페이지로 fallback한다.
- 인코딩된 URL 길이가 2,000자를 넘으면 경고를 낸다(일부 메신저가 링크를 자른다). ⚙️ 튜닝 대상

## 10. 픽셀 캐릭터 시스템

### 컨셉: Claude 마스코트 베이스
- 베이스는 **1종**. Claude 마스코트 실루엣(네모 몸통, 양옆 팔, 다리 4개, 네모 눈 2개)을 32×32로 옮긴다. 참고 이미지는 `docs/ref/mascot.png`.
- 16종 구분은 세 겹으로 한다.

| 레이어 | 변형 | 역할 |
|---|---|---|
| 몸 색 | 기질 4그룹별 색상. NT 보라, NF 민트, SJ 테라코타(원본 색), SP 노랑 | 멀리서도 그룹 구분 |
| 눈·표정 | E는 큰 눈, I는 반쯤 감은 눈. T는 일자 눈, F는 둥근 눈 | 같은 색 안에서 개체 구분 |
| 소품 | 유형별 8×8 아이콘을 옆이나 머리 위에 | 별명과 연결 |

- 기질 그룹: NT = INTJ, INTP, ENTJ, ENTP / NF = INFJ, INFP, ENFJ, ENFP / SJ = ISTJ, ISFJ, ESTJ, ESFJ / SP = ISTP, ISFP, ESTP, ESFP

### 스펙
- 크기 **32×32**, 공통 **16색 팔레트**(0번은 투명).
- 팔레트 초안: 투명 1, 검정 1, 흰색 1, 회색 2단계, 몸 색 4종 × (기본, 그림자) 8, 소품용 빨강과 파랑 2. 합 16. 확정은 픽셀 에이전트가 시안과 함께 제출한다.
- 애니메이션은 아래 "표정, 액세서리, 움직임" 절을 따른다. 유형당 6프레임, `anims`로 묶음.

### 데이터 포맷 (git diff로 리뷰 가능하게)
```json
{
  "id": "ENFP",
  "size": 32,
  "fps": 4,
  "frames": [
    [
      "................................",
      "..........1111111111............",
      "... 32줄, 문자 하나 = 픽셀 하나 ..."
    ]
  ]
}
```
- `.`은 투명, `0-9a-f`는 팔레트 인덱스다.
- 로드할 때 행 길이와 행 개수를 검증하는 테스트를 넣는다.

### 렌더러
- **터미널** (`cli/src/terminal`): 반블록 `▀`로 위 픽셀은 전경색, 아래 픽셀은 배경색을 써서 32×32를 16줄로 찍는다. truecolor(`COLORTERM=truecolor`) → 256색 → `NO_COLOR`/파이프일 때는 캐릭터를 생략하는 순서로 fallback한다. 애니메이션은 하지 않고 1프레임만 출력한다.
- **웹**: `<canvas>`에 정수 배율로 그리고 `image-rendering: pixelated`를 적용한다. `requestAnimationFrame`으로 프레임을 돌리고, `prefers-reduced-motion`이면 정지한다.

### 유형별 별명과 소품
| 유형 | 별명 | 소품 |
|---|---|---|
| INTJ | 리베이스 장인 | 일자로 정리된 커밋 트리 |
| INTP | 토끼굴 탐험가 | 끝없는 브라우저 탭 |
| ENTJ | 스프린트 사령관 | 칸반 보드 |
| ENTP | 레거시 방화범 | 불붙은 legacy 폴더 |
| INFJ | 주석 시인 | 정성스러운 README |
| INFP | 미완성 레포 수집가 | 반쯤 지은 레포 더미 |
| ENFJ | 코드리뷰 멘토 | LGTM 도장 |
| ENFP | 브랜치 메뚜기 | 사방으로 뻗은 브랜치 |
| ISTJ | 린터 수호자 | 체크리스트 |
| ISFJ | 온콜 지킴이 | 울리는 호출기 |
| ESTJ | 컨벤션 경찰 | PR 템플릿 |
| ESFJ | 이모지 리액션 요정 | 이모지 말풍선 |
| ISTP | "고쳐" 장인 | 렌치 |
| ISFP | 1px 장인 | 픽셀 자 |
| ESTP | prd 직배포러 | 불타는 서버 |
| ESFP | 데모 장인 | 마이크 |

- 별명은 콘텐츠 에이전트가 다듬을 수 있다. 벌레 이름이 들어간 별명은 캐릭터와 안 맞으면 바꾼다.

### 표정, 액세서리, 움직임 (2026-11-04 확정)

**표정.** 눈, 눈썹, 입 세 파츠 조합. 16종 전부 다른 얼굴.

| 유형 | 눈 | 입 |
|---|---|---|
| INTJ | 반쯤 감음, 한쪽 눈썹 올림 | 일자 |
| INTP | 양쪽 크기 다름 | 작게 벌린 o |
| ENTJ | 치켜뜬 눈썹, 날카로운 눈 | 꽉 다문 일자 |
| ENTP | 한쪽 윙크 | 비대칭 씩 웃음 |
| INFJ | 부드러운 둥근 눈 | 작은 미소 |
| INFP | 반짝이 눈 | 작은 ㅅ 입 |
| ENFJ | 둥근 눈 | 넓은 미소 |
| ENFP | 큰 눈 반짝 | 벌린 웃음 |
| ISTJ | 네모 눈 | 일자 |
| ISFJ | 둥근 눈, 처진 눈썹 | 작은 미소 |
| ESTJ | 내려간 눈썹 | 일자 |
| ESFJ | 웃는 눈 ^ ^ | 큰 미소 |
| ISTP | 반쯤 감음 | 한쪽 올라간 입 |
| ISFP | 감은 눈 | 작은 미소 |
| ESTP | 선글라스 | 삐딱한 씩 |
| ESFP | 별 모양 눈 | 크게 벌린 입 |

**액세서리.** 머리 위 아이템 하나(8px 자리), 얼굴 또는 손 아이템 하나(팔 앞에 겹쳐 그림).

| 유형 | 머리 위 | 얼굴 또는 손 |
|---|---|---|
| INTJ | 일자 커밋 트리 | 가는 사각 안경 |
| INTP | 탐험가 헤드램프 | 옆에 탭 더미 |
| ENTJ | 사령관 베레모 | 손에 칸반 카드 |
| ENTP | 타오르는 불꽃 머리 | 손에 성냥 |
| INFJ | 깃펜 | 둥근 안경 |
| INFP | 반쯤 쌓은 블록 | 눈가 눈물 한 방울 |
| ENFJ | LGTM 도장 | 없음 |
| ENFP | 사방으로 뻗은 브랜치 | 등에 작은 배낭 |
| ISTJ | 체크리스트 클립보드 | 네모 안경 |
| ISFJ | 울리는 호출기 | 눈 밑 다크서클 |
| ESTJ | 경찰 모자 | 손에 PR 템플릿 |
| ESFJ | 이모지 말풍선 | 등에 작은 요정 날개 |
| ISTP | 안전모 | 손에 렌치 |
| ISFP | 화가 베레모 | 손에 픽셀 붓 |
| ESTP | 불타는 작은 서버 | 선글라스 |
| ESFP | 파티 모자 | 손에 마이크 |

**움직임.**
- 캐릭터 JSON에 `anims` 항목을 추가한다. 프레임 순서를 이름으로 묶고 프레임은 복제하지 않는다.
  ```json
  { "id": "ENFP", "size": 32, "fps": 6,
    "frames": [ ...6장... ],
    "anims": { "idle": [0], "blink": [1], "wave": [2,3,2,3,0], "walk": [4,5] } }
  ```
- 유형당 기본 6프레임: 기본, 깜빡임, 인사 2, 걷기 2. 유형별 시그니처 동작(불꽃 흔들림, 호출기 진동 등)은 이후 라운드에서 추가.
- 깜빡임 타이밍은 데이터가 아니라 플레이어가 잡는다 (2026-11-04 확정). `idle`은 기본 프레임만, `blink`는 눈 감은 프레임만 둔다. 웹 플레이어는 3초에서 5초 사이 랜덤 간격으로 blink 를 120ms 끼워 넣고, 10번 중 1번은 200ms 뒤 한 번 더 깜빡인다. wave 중에는 깜빡이지 않는다. 상수는 플레이어 파일 상단 한 곳에. ⚙️ 튜닝 대상
- 웹 결과 페이지: 진입 시 `wave` 한 번 후 `idle` 반복, 탭하면 다시 `wave`. 랜딩 하단: 캐릭터 몇 마리가 `walk`로 좌우 이동. `prefers-reduced-motion`이면 정지.
- 터미널: 정지 1프레임(`idle` 첫 프레임).
- 캐릭터별 랜덤 행동 (2026-11-04 확정): 인스턴스마다 자기 시드를 갖고 2초에서 6초 랜덤 간격으로 주사위를 굴린다. 절반은 skip, 나머지는 동작 풀에서 가중치로 하나. 풀: blink 4, doubleBlink 1, wave 1, walkInPlace 2, hop 1, shuffle 1. 유형별 시그니처 anim 이 생기면 같은 풀에 들어간다. 결과 페이지 주인공만 진입 시 wave 한 번 후 스케줄러로. 페이지당 rAF 루프 하나로 돌리고 탭이 숨겨지면 멈춘다. ⚙️ 튜닝 대상

**제작 방식.** 레이어 파일(몸체, 눈, 입, 눈썹, 액세서리, 팔 포즈, 다리 포즈)을 `packages/core/pixelsrc/`에 두고 `scripts/pixel-compose.mjs`가 `characters/*.json`을 생성한다. 산출물 JSON은 커밋해서 diff 리뷰한다. 16종 전부 2라운드에서 만든다(M6의 13종을 당겨 옴).

## 11. 스킬 (`skill/SKILL.md`)

설치 위치는 `~/.claude/skills/llmbti/SKILL.md`이다. SKILL.md에 들어갈 내용:

1. frontmatter: `name: llmbti`, description은 "사용자가 /llmbti, 개발자 MBTI, llmbti 분석을 요청할 때 사용".
2. 절차:
   1. 셸 히스토리 포함 여부를 사용자에게 묻는다(한 번만).
   2. `npx -y llmbti analyze --json [--no-shell] > /tmp/llmbti-analysis.json`을 실행한다.
   3. 결과 JSON을 읽는다. `insufficient: true`면 "아직 덜 컴파일됨" 메시지를 주고 종료한다.
   4. 8장의 스키마와 톤 규칙에 맞춰 CopyJson을 작성하고 `/tmp/llmbti-copy.json`에 저장한다.
   5. `npx -y llmbti render --analysis /tmp/llmbti-analysis.json --copy /tmp/llmbti-copy.json`을 실행한다. 검증 에러가 나면 수정해서 다시 실행한다(최대 2회).
   6. 마지막에 결과 URL을 한 줄로 안내한다. 터미널 출력을 다시 요약하지 않는다.
3. 금지 사항: 원본 로그 파일을 직접 열어 읽지 않는다(토큰 낭비와 프라이버시 문제). analyze 출력만 사용한다.

## 12. CLI 명령

| 명령 | 동작 |
|---|---|
| `llmbti` (=`run`) | 라이트 모드: analyze → 템플릿 문구 → render |
| `llmbti install` | `skill/`을 `~/.claude/skills/llmbti/`로 복사. 이미 있으면 덮어쓸지 물어봄. `--force` 옵션 지원 |
| `llmbti analyze [--json] [--days N] [--no-shell]` | 집계 결과 출력 |
| `llmbti render --analysis F --copy F [--no-open]` | 검증 → 터미널 출력 → URL 출력 → 브라우저 열기 |

- 브라우저 열기: macOS는 `open`, Linux는 `xdg-open`, Windows는 `start`. 실패하면 URL만 출력한다.
- 터미널 출력 레이아웃: 왼쪽에 캐릭터 16줄, 오른쪽에 유형, 별명, 4축 바(`E ████░░ I`), evidence 3줄. 폭이 80칸 미만이면 세로로 쌓는다.

## 13. 웹 (`apps/web`)

| 경로 | 역할 | 내용 |
|---|---|---|
| `/` | 나의 LLM MBTI는 무엇일까? | 훅 한 줄, `$ npx llmbti` 타이핑 애니메이션, 예시 결과 3개, "테스트 시작" 버튼 → `/start` |
| `/start` | 테스트 방법 | 순서대로 안내. 1. `npx llmbti install` 복사 2. Claude Code에서 `/llmbti` 3. 셸 히스토리 동의 4. 결과 URL 열기. 아래에 Claude 없이 `npx llmbti`만 돌리는 라이트 모드 안내와 "서버 없음" 프라이버시 설명 |
| `/t/{TYPE}` | 공유 페이지 | hash가 있으면 개인 결과와 공유 버튼, 없으면 유형 소개. "나도 해보기"는 `/start`로 연결 |
| `/types` | 16종 도감 | 그리드. 랜딩과 공유 페이지 하단에서 링크 |

**공유 페이지 구성 (모바일 우선)**
1. 픽셀 캐릭터(애니메이션) + 유형 + 별명
2. roast 본문
3. 4축 게이지
4. evidence 3개 + 통계 배지
5. 오늘의 커밋 메시지(코드 블록 스타일)
6. 페어 궁합 카드 → 해당 유형 페이지로 링크
7. 공유: 링크 복사, Web Share API, 카드 PNG 다운로드(canvas 1200×630, 클라이언트에서 생성)
8. "나도 해보기": `/start` 링크 + `npx llmbti install` 복사

**디자인 톤:** 다크 터미널 베이스, 모노스페이스 + 픽셀 폰트 포인트, 팔레트는 캐릭터 팔레트와 공유.

**빌드:** `vite build`로 정적 빌드. 유형별 OG 이미지 16장은 빌드 스크립트가 픽셀 데이터에서 PNG로 생성한다(빌드 타임 devDependency는 허용). `vercel.json`에서 `/t/*` 라우팅을 처리한다. 유형별 HTML을 빌드 타임에 16개 생성해서 각 HTML에 OG 메타를 박는 방식을 권장한다.

## 14. 마일스톤

| # | 내용 | 완료 조건 |
|---|---|---|
| M0 | 모노레포 세팅, lint/test/tsup, core 타입·codec, 빈 웹 Vercel 배포 | `pnpm build` 통과, 배포 URL 접속 가능 |
| M1 | 파서 + 시그널 + 점수 + redact + analyze 명령 | fixtures 기반 단위 테스트 통과, 같은 입력이면 같은 결과, redact 테스트(시크릿 패턴 10종 이상) 통과 |
| M2 | 웹 3페이지 + 공유 페이지 결과 렌더링(캐릭터 자리는 placeholder) | CLI로 만든 URL이 웹에서 정상 렌더링, 깨진 hash면 fallback |
| M3 | 팔레트 + 베이스 + 샘플 3종(INTJ, ENFP, ISTP) + 터미널/캔버스 렌더러 | 터미널과 웹에 같은 캐릭터가 뜨고 truecolor/256/no-color fallback 동작 |
| M4 | SKILL.md + install + render 검증 + 라이트 모드 템플릿 | 실제 Claude Code에서 `/llmbti` 한 번에 URL까지 도달, `npx llmbti` 단독 실행 동작 |
| M5 | 공유(카드 PNG, Web Share), 유형별 정적 페이지 + OG | 메신저에 링크를 붙이면 유형별 OG가 뜸 |
| M6 | 나머지 13종 캐릭터, 랜딩 마감, 도감, npm publish | 16종 완성, `npx llmbti` 공개 동작 |

## 15. 하지 않는 것

- 서버, 계정, 결과 저장, 랭킹, 댓글
- 원본 로그 업로드
- Claude 마스코트 외의 기존 캐릭터나 브랜드 패러디
- 결과 추적 목적의 애널리틱스(필요하면 페이지뷰 수준의 Vercel Analytics만)

## 16. 열린 질문 (TODO(decision))

1. 영어 지원 시점. M6 이후로 미룬다.
2. Cursor나 Codex 등 다른 도구의 로그 지원 여부. 지금은 Claude Code만.
3. 공유 페이지에 Claude 마스코트를 쓰는 데 대한 표기(크레딧) 문구를 넣을지.

확정된 것
- 이름: `llmbti`
- 캐릭터: Claude 마스코트 베이스, 몸 색 4그룹
- 셸 히스토리: 동의 후 ON
