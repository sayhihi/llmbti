# llmbti

LLM(Claude Code)에게 일을 시키는 패턴과 셸 명령 히스토리를 분석해서, 개발자의 MBTI를 픽셀 캐릭터와 개발 유머 디스로 보여주는 사이드프로젝트.

```
> typeof me
"ENFP" // 브랜치 23개, 머지 0개
```

- 실행: `npx llmbti`
- 웹: https://llmbti.vercel.app
- 슬래시 명령: `/llmbti`

## 빠른 시작

Claude Code가 있으면 스킬을 설치하고 슬래시 명령을 부른다. 분석은 스크립트가 하고, 디스 문구는 Claude가 쓴다.

```sh
npx llmbti install
```

그 다음 Claude Code에서

```
/llmbti
```

Claude Code를 안 쓰면 라이트 모드로 돈다. 셸 히스토리만으로 유형이 나오고, 문구는 유형별 템플릿을 쓴다.

```sh
npx llmbti
```

둘 다 마지막에 결과 URL을 찍고 브라우저를 연다. `--no-open`을 붙이면 URL만 찍는다.

## 무엇을 읽고 무엇이 나가는지

읽는 것은 로컬 파일 네 가지다. `~/.claude/history.jsonl`, `~/.claude/projects/`, `~/.zsh_history`, `~/.bash_history`. 셸 히스토리는 읽기 전에 한 번 묻는다. 기본 30일치, `--days N`으로 바꾼다.

나가는 것은 결과뿐이다. 원본 로그는 기기 밖으로 나가지 않는다.

- 사이트는 정적 파일만 있다. API, DB, 서버리스 함수가 없다.
- 결과는 URL의 `#r=` 뒤에 압축돼 실린다. 브라우저는 hash를 서버로 보내지 않는다.
- URL에 담기는 것은 유형, 축 점수, 배지 숫자, 문구뿐이다. 프롬프트 원문과 셸 명령 원문은 담기지 않는다.
- Claude에게 가는 샘플 프롬프트는 토큰, 이메일, 경로를 마스킹한 뒤 보낸다. 문구도 render 단계에서 한 번 더 마스킹한다.
- 결과를 저장하지 않는다. 링크를 잃으면 다시 돌리면 된다.

## 명령

| 명령                                              | 동작                                                                                                    |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `llmbti` (=`run`)                                 | 라이트 모드: analyze, 템플릿 문구, render                                                               |
| `llmbti install [--force]`                        | `skill/`을 `~/.claude/skills/llmbti/`로 복사. 이미 있으면 덮어쓸지 묻는다. `CLAUDE_CONFIG_DIR`를 따른다 |
| `llmbti analyze [--json] [--days N] [--no-shell]` | 로그 집계 결과 출력                                                                                     |
| `llmbti render --analysis F --copy F [--no-open]` | 문구 검증, 터미널 출력, 결과 URL 출력, 브라우저 열기                                                    |

공통 옵션: `--days N`(기본 30), `--no-shell`, `--yes`(셸 질문 생략), `--no-open`, `--base URL`(기본 `https://llmbti.vercel.app`, 환경변수 `LLMBTI_BASE_URL`), `--no-color`(캐릭터 생략).

## 4축

점수는 축마다 -100에서 100이고 양수면 앞 글자다. E/I는 대화형과 독백형으로, 세션당 턴 수와 물음표 비율이 높으면 E, 프롬프트가 길면 I다. S/N은 구체와 추상으로, 경로나 스택트레이스를 붙이면 S, "구조", "설계", "refactor" 같은 말이 많으면 N이다. T/F는 건조와 다정으로, 20자 이하 명령형이 많으면 T, "고마워"와 "ㅠ"가 많으면 F다. J/P는 계획형과 즉흥형으로, plan 모드와 테스트 실행이 많으면 J, `--force`와 `rm -rf`와 "아니 그게 아니라"가 많으면 P다. 같은 입력이면 항상 같은 결과가 나온다. LLM은 점수에 손대지 않고 문구만 쓴다.

## 로컬 개발

pnpm 모노레포다. `packages/core`(타입, codec, 캐릭터 데이터), `packages/cli`(npm 패키지 `llmbti`), `apps/web`(결과 페이지), `skill/`(Claude Code 스킬).

```sh
pnpm install
pnpm build        # core, cli(tsup), web
pnpm test         # vitest, fixtures/ 의 가짜 로그로 돈다
pnpm typecheck
pnpm lint
```

- `pnpm pixel:compose` 픽셀 캐릭터 데이터 조립. `pnpm pixel:validate`, `pnpm pixel:preview`도 있다.
- `pnpm deploy:web` 웹을 로컬 prebuilt로 Vercel 프로덕션에 배포한다.
- `packages/cli`에서 `pnpm preview`로 터미널 레이아웃만 따로 본다.

실제 로그 파일은 레포에 커밋하지 않는다. `fixtures/` 아래의 가짜 로그만 쓴다.

## 라이선스

MIT. `LICENSE` 참고.

캐릭터는 Anthropic의 Claude 마스코트 실루엣을 바탕으로 그렸습니다. 비공식 팬 프로젝트입니다.
