# fixtures

테스트용 가짜 로그만 둔다. 실제 `~/.claude` 로그나 셸 히스토리를 커밋하지 않는다.

생성기: `node fixtures/generate.mjs`. 결과물은 결정적이라 다시 돌려도 같은 파일이 나온다. 손으로 고치지 말고 생성기를 고친다.

- `home-j/`  J형 테스터 페르소나 (bash 히스토리, 긴 세션, 테스트 많이)
- `home-p/`  P형 force-pusher 페르소나 (zsh extended 히스토리, 새벽, --force, rm -rf, 시크릿 섞음)
- `home-tiny/` 표본 부족 (insufficient 확인용)
