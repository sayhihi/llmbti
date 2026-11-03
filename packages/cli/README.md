# llmbti

Claude Code에 일을 시키는 말투와 셸 히스토리로 보는 개발자 MBTI.
점수는 스크립트가 계산하고, 디스는 Claude가 쓴다.

```
$ npx llmbti install
> /llmbti
ENFP  // 브랜치 23개, 머지 0개
```

👉 https://llmbti.vercel.app

## 빠른 시작

```sh
npx llmbti install   # Claude Code 스킬 설치
```

Claude Code에서 `/llmbti` 를 치면 끝. 터미널에 픽셀 캐릭터와 결과 링크가 뜬다.

Claude Code가 없으면 라이트 모드. 셸 히스토리만으로 유형이 나오고 문구는 템플릿을 쓴다.

```sh
npx llmbti
```

## 16종 도감

<table>
  <tbody>
    <tr>
      <td align="center" width="25%"><img src="https://llmbti.vercel.app/characters/INTJ.png" width="96" alt="INTJ"><br><b>INTJ</b><br>리베이스 장인<br><sub>머지 커밋은 눈에 거슬려서 못 참음</sub></td>
      <td align="center" width="25%"><img src="https://llmbti.vercel.app/characters/INTP.png" width="96" alt="INTP"><br><b>INTP</b><br>토끼굴 탐험가<br><sub>왜 되는지 알아내다 원래 하려던 걸 잊음</sub></td>
      <td align="center" width="25%"><img src="https://llmbti.vercel.app/characters/ENTJ.png" width="96" alt="ENTJ"><br><b>ENTJ</b><br>스프린트 사령관<br><sub>Claude한테도 데드라인을 준다</sub></td>
      <td align="center" width="25%"><img src="https://llmbti.vercel.app/characters/ENTP.png" width="96" alt="ENTP"><br><b>ENTP</b><br>레거시 방화범<br><sub>이거 다 갈아엎으면 되는데요?</sub></td>
    </tr>
    <tr>
      <td align="center" width="25%"><img src="https://llmbti.vercel.app/characters/INFJ.png" width="96" alt="INFJ"><br><b>INFJ</b><br>주석 시인<br><sub>코드보다 README가 긴 사람</sub></td>
      <td align="center" width="25%"><img src="https://llmbti.vercel.app/characters/INFP.png" width="96" alt="INFP"><br><b>INFP</b><br>미완성 레포 수집가<br><sub>첫 커밋은 완벽, 두 번째 커밋은 없음</sub></td>
      <td align="center" width="25%"><img src="https://llmbti.vercel.app/characters/ENFJ.png" width="96" alt="ENFJ"><br><b>ENFJ</b><br>코드리뷰 멘토<br><sub>LGTM 전에 코멘트 열 줄은 기본</sub></td>
      <td align="center" width="25%"><img src="https://llmbti.vercel.app/characters/ENFP.png" width="96" alt="ENFP"><br><b>ENFP</b><br>브랜치 방랑자<br><sub>브랜치 23개, 머지 0개</sub></td>
    </tr>
    <tr>
      <td align="center" width="25%"><img src="https://llmbti.vercel.app/characters/ISTJ.png" width="96" alt="ISTJ"><br><b>ISTJ</b><br>린터 수호자<br><sub>린트 안 돌린 PR은 PR이 아님</sub></td>
      <td align="center" width="25%"><img src="https://llmbti.vercel.app/characters/ISFJ.png" width="96" alt="ISFJ"><br><b>ISFJ</b><br>온콜 지킴이<br><sub>새벽 알림 받고도 미안하다고 하는 사람</sub></td>
      <td align="center" width="25%"><img src="https://llmbti.vercel.app/characters/ESTJ.png" width="96" alt="ESTJ"><br><b>ESTJ</b><br>컨벤션 경찰<br><sub>PR 템플릿 안 채우면 리뷰 안 함</sub></td>
      <td align="center" width="25%"><img src="https://llmbti.vercel.app/characters/ESFJ.png" width="96" alt="ESFJ"><br><b>ESFJ</b><br>이모지 리액션 요정<br><sub>코드 리뷰보다 리액션이 빠른 사람</sub></td>
    </tr>
    <tr>
      <td align="center" width="25%"><img src="https://llmbti.vercel.app/characters/ISTP.png" width="96" alt="ISTP"><br><b>ISTP</b><br>"고쳐" 장인<br><sub>프롬프트 평균 길이 두 글자</sub></td>
      <td align="center" width="25%"><img src="https://llmbti.vercel.app/characters/ISFP.png" width="96" alt="ISFP"><br><b>ISFP</b><br>1px 장인<br><sub>안 보이는 1px 차이가 보이는 사람</sub></td>
      <td align="center" width="25%"><img src="https://llmbti.vercel.app/characters/ESTP.png" width="96" alt="ESTP"><br><b>ESTP</b><br>prd 직배포러<br><sub>테스트는 prd 사용자가 해 줌</sub></td>
      <td align="center" width="25%"><img src="https://llmbti.vercel.app/characters/ESFP.png" width="96" alt="ESFP"><br><b>ESFP</b><br>데모 장인<br><sub>동작하는 건 데모 때만</sub></td>
    </tr>
  </tbody>
</table>

## 어떻게 정하나

- 유형은 스크립트가 정한다. 같은 로그면 항상 같은 결과다. Claude는 디스 문구만 쓴다.
- 서버가 없다. 결과는 링크 안에만 있고 어디에도 저장되지 않는다.
- 원본 로그는 기기 밖으로 나가지 않는다. 읽는 건 `~/.claude` 로그와 셸 히스토리이고, 셸 히스토리는 읽기 전에 묻는다.

## 명령

| 명령                                      | 동작                   |
| ----------------------------------------- | ---------------------- |
| `npx llmbti`                              | 라이트 모드 실행       |
| `npx llmbti install`                      | Claude Code 스킬 설치  |
| `npx llmbti analyze --json`               | 집계 결과만 JSON으로   |
| `npx llmbti render --analysis F --copy F` | 문구 검증 후 결과 출력 |

옵션: `--days N` (기본 30), `--no-shell`, `--yes`, `--no-open`

## 개발

```sh
pnpm install && pnpm build && pnpm test
pnpm pixel:compose   # 캐릭터 레이어 조립
pnpm deploy:web      # Vercel 배포
```

## 라이선스

MIT. 캐릭터는 Anthropic의 Claude 마스코트 실루엣을 바탕으로 그린 비공식 팬 프로젝트다.
