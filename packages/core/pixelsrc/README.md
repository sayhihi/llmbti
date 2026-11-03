# pixelsrc

`scripts/pixel-compose.mjs` 가 이 폴더의 레이어를 `characters.json` 레시피대로 겹쳐서
`packages/core/src/characters/*.json` 을 만든다. 손으로 고치는 건 여기, 산출물은 재생성.

```
pnpm pixel:compose && pnpm pixel:validate && pnpm pixel:preview
```

## 레이어 파일

```json
{ "x": 10, "y": 11, "rows": ["111", "111", "111"] }
```

- `x`, `y` 는 32×32 캔버스 안의 왼쪽 위 좌표. `rows` 는 한 글자가 한 픽셀.
- `.` 은 투명, `0-9a-f` 는 `palette.json` 인덱스.
- **`5`/`6` 은 "몸 색 기본/그림자"** 라는 뜻이다. 기질(nt/nf/sj/sp)에 맞춰 7/8, 9/a, 5/6, b/c 로 바뀐다.
  몸 색이 아닌 곳에 5/6 을 쓰면 안 된다.
- 조각이 여러 개면 `{ "parts": [ {x,y,rows}, ... ] }`. `back/` 의 조각에 `"slot": "front"` 를 주면
  몸 뒤가 아니라 몸 앞(팔보다 뒤)에 그린다 (배낭 끈 등).

## 그룹과 겹치는 순서 (뒤 → 앞)

back(뒤) → body → back(front 조각) → legs → arms → hand → eyes → mouths → face → brows → head

## 자리 약속 (1라운드 기하 유지)

- 몸통(머리 포함) 9–24행, 7–24열. 눈 11–13행, 왼눈 10–12열, 오른눈 19–21열. 입 15–18행.
- 팔 14–18행, 왼팔 2–6열, 오른팔 25–29열. 흔드는 팔은 오른팔(보는 사람 기준 오른쪽).
- 다리 25–29행. 손 아이템은 0–6열, 9–22행 (왼팔 앞에 겹침).
- 머리 위 아이템은 0–8행, 10열 이하 × 8행 이하. 몸을 아래로 밀지 않는다.

## 프레임

`characters.json` 의 `frames` 가 6프레임의 팔·다리 포즈를 정하고, `anims` 가 프레임 인덱스를 묶는다.
`anims.idle` 은 기본 프레임만(`[0]`), `anims.blink` 는 눈 감은 프레임만(`[1]`). 깜빡임 타이밍은 플레이어가 잡는다.
유형별 시그니처 동작은 나중에 별도 이름(예: `flicker`)으로 붙인다.
`blink` 프레임은 눈만 `eyes/blink` 로 바꾼다 (유형별로 `blink` 에 다른 그룹 덮어쓰기 가능).
