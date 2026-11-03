---
name: llmbti
description: 사용자가 /llmbti, 개발자 MBTI, llmbti 분석을 요청할 때 사용
---

# llmbti

LLM에게 일을 시키는 패턴과 셸 히스토리로 개발자 MBTI를 뽑는다. 점수와 유형은 스크립트가 정하고, Claude는 문구만 쓴다.

## 절차

임시 파일은 `/tmp/llmbti-analysis.json`, `/tmp/llmbti-copy.json`을 쓴다. Windows면 `%TEMP%` 아래 같은 이름으로 바꿔 쓴다.

1. `npx -y llmbti@latest install --sync` 를 먼저 실행한다. 이 스킬 파일을 최신 패키지 동봉본과 맞추는 단계다. 출력이 없으면 이미 최신이다. "스킬 갱신"이 찍히면 다음 실행부터 새 절차가 적용된다고 한 줄 알리고 그대로 진행한다.
2. 셸 히스토리(zsh, bash)도 같이 분석할지 사용자에게 한 번만 묻는다. 기본값은 포함이다. 이미 답했으면 다시 묻지 않는다.
3. `npx -y llmbti@latest analyze --json > /tmp/llmbti-analysis.json` 을 실행한다. 셸을 빼기로 했으면 `--no-shell`을 붙인다.
4. `/tmp/llmbti-analysis.json`을 읽는다. `insufficient`가 `true`면 "아직 덜 컴파일됨. 프롬프트 N개, 셸 명령 M개로는 유형이 안 나온다"라고 알리고 끝낸다. N, M은 `sampleSize.prompts`, `sampleSize.shell`이다.
5. 아래 스키마와 톤 규칙대로 CopyJson을 써서 `/tmp/llmbti-copy.json`에 저장한다. 숫자는 `stats`, `signals`, `sampleSize`, `scores`에서만 가져온다. `samples`는 웃긴 포인트를 잡는 참고용이고, 인용은 짧게 한 번까지만 한다. `type`은 바꾸지 않는다.
6. `npx -y llmbti@latest render --analysis /tmp/llmbti-analysis.json --copy /tmp/llmbti-copy.json` 을 실행한다. 검증 에러가 번호 목록으로 나오면 해당 항목만 고쳐서 다시 실행한다. 최대 2회.
7. render 가 찍은 터미널 출력(캐릭터 블록, 유형과 별명, 4축 바, evidence, 커밋 메시지, URL 줄)을 코드 블록 안에 그대로 붙여서 보여 준다. 줄을 빼거나 고쳐 쓰지 않는다. 그 아래에 결과 URL을 한 줄 더 적는다. 그 외 요약이나 해설은 붙이지 않는다.

## 금지

- 원본 로그(`~/.claude/history.jsonl`, `~/.claude/projects/`, `~/.zsh_history`, `~/.bash_history`)를 직접 열거나 grep 하지 않는다. 토큰 낭비이고 프라이버시 문제다. analyze 출력 JSON만 본다.
- analyze 출력의 `type`, `scores`를 고치지 않는다.

## analyze 출력에서 쓸 것

- `type`, `scores` (EI, SN, TF, JP: -100..100, 양수면 앞 글자), `borderline` (경계 축)
- `sampleSize.prompts`, `sampleSize.shell`, `periodDays`
- `stats`: `promptCount`, `shellCount`, `sessionCount`, `avgTurns`, `longestSession`, `peakHour`, `nightRatio`(%), `forceCount`, `rmrfCount`, `sudoBangCount`, `redoCount`, `thanksCount`, `interruptCount`, `topCommand`, `topCommands`, `shortestPrompt`, `mostRepeatedPrompt`, `topTool`
- `signals`: 비율 0..1 (`questionRatio`, `shortImperativeRatio`, `emotionRatio`, `planRatio`, `testRatio`, `redirectRatio` 등). 퍼센트로 바꿔 쓴다.
- `badges`: 배지 키. 문구에 녹이면 좋다.

## CopyJson 스키마

```json
{
  "lang": "ko",
  "nickname": "20자 이하 별명",
  "roast": "2~3문장, 200자 이하. 숫자 1~2개.",
  "evidence": ["60자 이하, 숫자 필수", "60자 이하, 숫자 필수", "60자 이하, 숫자 필수"],
  "commitMessage": "50자 이하",
  "pairWith": { "type": "INTJ", "reason": "40자 이하" }
}
```

- `evidence`는 정확히 3개. 각 항목에 숫자가 하나는 있어야 한다.
- 문장 수는 `.`, `!`, `?` 뒤에 공백이나 끝이 오는 자리로 센다. `2.1자` 같은 소수점은 안 센다.
- `pairWith.type`은 16개 유형 중 하나. 본인 유형과 달라야 재밌다.

## 문구 톤 규칙

### 톤

- 근거 있는 디스가 기본이다. analyze 결과에 있는 실제 숫자를 쓴다. 숫자 없는 디스는 쓰지 않고, 숫자 없는 칭찬은 더 쓰지 않는다.
- 동료가 옆자리에서 놀리듯 쓴다. 비하가 아니라 놀리는 수준이다. 읽은 사람이 공유하고 싶어야 한다.
- 담백한 구어체 한국어. AI가 쓴 티가 나면 실패다. "당신은", "~하는 당신", "멋져요", "훌륭한 개발자" 같은 말은 쓰지 않는다.
- 개발 밈을 적극 쓴다. git, PR, 린터, 온콜, 레거시, 테스트, 배포, 토큰, 머지, 리베이스, 핫픽스, wip.
- 프로덕션은 "prd"라고 쓴다.
- 미사여구와 버즈워드 금지. "혁신", "시너지", "열정", "성장하는", "진정한" 같은 단어가 나오면 다시 쓴다.
- 문장은 짧게. 한 문장에 숫자 하나면 충분하다.

### 금지

- 외모, 성별, 나이, 국적 같은 개인 속성을 언급하지 않는다. 추측도 하지 않는다.
- 회사명, 프로젝트명, 파일 경로, 레포 이름, 사람 이름을 쓰지 않는다. analyze 샘플에 들어 있어도 문구에 옮기지 않는다.
- 가운뎃점과 줄표 금지. 구분은 쉼표나 콜론으로 한다. 괄호는 꼭 필요할 때 한 번까지.
- 이모지는 쓰지 않는다. 어느 필드든 이모지가 있으면 render 검증에서 거부된다. 느낌표는 commitMessage에서만 허용한다.
- 원본 로그를 직접 열어 읽지 않는다. analyze 출력 JSON만 본다.

### 길이 제한

| 필드            | 제한                     | 비고                                           |
| --------------- | ------------------------ | ---------------------------------------------- |
| nickname        | 20자 이하                | 유형 별명을 바탕으로 숫자나 습관을 붙여 구체화 |
| roast           | 2~3문장, 200자 이하      | 숫자 1~2개 포함                                |
| evidence        | 정확히 3개, 각 60자 이하 | 모든 항목에 실제 숫자 필수                     |
| commitMessage   | 50자 이하                | 영어 conventional commit 형식 권장             |
| pairWith.reason | 40자 이하                | 상대 유형 별명과 연결되면 좋다                 |

길이는 글자 수 기준이다. 공백과 문장부호도 센다. render가 검증하고, 넘으면 에러가 나니 짧게 쓰는 쪽이 안전하다.

### 좋은 예

```json
{
  "lang": "ko",
  "nickname": "새벽 force push 직배포러",
  "roast": "--force push 11번, 그중 7번이 새벽 3시다. 브랜치를 안 따고 main에서 쏘는데 그마저도 힘으로 민다. 커밋 메시지 절반이 fix인 건 솔직해서 좋다.",
  "evidence": ["--force push 11번", "새벽 2시에서 5시 사이 활동 34%", "커밋 메시지 중 fix 48%"],
  "commitMessage": "fix: prod again",
  "pairWith": { "type": "INFJ", "reason": "쏘고 나면 문서는 저쪽이 써 줌" }
}
```

roast만 하나 더: "세션당 평균 31턴, 최장 세션 112턴. 버그 하나 잡으러 들어가서 라이브러리 소스를 다 읽고 나왔다. 버그는 아직 그대로다." 숫자가 앞에 나오고, 그 숫자가 왜 웃긴지 두 문장으로 끝난다. 설명하지 않고 놀린다.

### 나쁜 예

- "열정 넘치는 혁신가! 빠른 실행력으로 팀을 이끄는 당신, 정말 멋져요." 숫자가 없고, 칭찬이고, AI가 쓴 티가 난다.
- "나이 좀 있어서 그런가 · 레거시만 붙잡고 있음 — 회사 코드 ~/work/acme-api 보면 답 나옴 (ㅋㅋ)" 가운뎃점, 줄표, 괄호, 나이, 경로, 프로젝트명. 숫자가 있어도 못 내보낸다.

### 쓰기 전 체크

1. evidence 3개에 전부 숫자가 있는가
2. roast에 숫자가 최소 하나 있고, 그 숫자가 analyze 출력에 실제로 있는가
3. 가운뎃점, 줄표, 이모지, 경로, 이름이 없는가
4. 읽고 나서 웃긴가, 아니면 기분 나쁜가. 기분 나쁘면 다시 쓴다
