import { describe, expect, it } from "vitest";
import { classifyPrompt } from "./prompts";

describe("classifyPrompt", () => {
  it("물음표 질문", () => {
    expect(classifyPrompt("이거 왜 안 돼?").question).toBe(true);
    expect(classifyPrompt("why？ ").question).toBe(true);
    expect(classifyPrompt("고쳐").question).toBe(false);
  });

  it("끼어들기: 잠깐/아니/stop 으로 시작. '아니면' 은 아님", () => {
    expect(classifyPrompt("잠깐 멈춰").interrupt).toBe(true);
    expect(classifyPrompt("아니 그게 아니라").interrupt).toBe(true);
    expect(classifyPrompt("stop").interrupt).toBe(true);
    expect(classifyPrompt("Wait, that's wrong").interrupt).toBe(true);
    expect(classifyPrompt("아니면 다른 방법은?").interrupt).toBe(false);
    expect(classifyPrompt("stopwatch 만들어줘").interrupt).toBe(false);
    expect(classifyPrompt("이건 아니지").interrupt).toBe(false);
  });

  it("구체: 파일 경로, 라인 번호, 코드블록, 스택트레이스", () => {
    expect(classifyPrompt("src/parsers/zsh.ts 고쳐").concrete).toBe(true);
    expect(classifyPrompt("index.ts 봐줘").concrete).toBe(true);
    expect(classifyPrompt("line 42 에서 터짐").concrete).toBe(true);
    expect(classifyPrompt("```\nconst a = 1\n```").concrete).toBe(true);
    expect(classifyPrompt("    at render (list.tsx:42:17)").concrete).toBe(true);
    expect(classifyPrompt("Traceback (most recent call last):").concrete).toBe(true);
    expect(classifyPrompt("전체 구조를 개선하자").concrete).toBe(false);
    expect(classifyPrompt("이거 왜 안 돼?").concrete).toBe(false);
  });

  it("추상 키워드", () => {
    for (const t of [
      "구조 바꾸자",
      "설계 다시",
      "아키텍처 고민",
      "깔끔하게 해줘",
      "개선해",
      "refactor this",
      "design better",
      "better approach?",
    ]) {
      expect(classifyPrompt(t).abstract, t).toBe(true);
    }
    expect(classifyPrompt("테스트 돌려").abstract).toBe(false);
  });

  it("에러 로그 붙여넣기", () => {
    expect(classifyPrompt("TypeError: Cannot read properties of undefined").errorPaste).toBe(true);
    expect(classifyPrompt("npm ERR! code ELIFECYCLE").errorPaste).toBe(true);
    expect(classifyPrompt("error TS2322: Type 'x'").errorPaste).toBe(true);
    expect(classifyPrompt("Process exited with exit code 1").errorPaste).toBe(true);
    expect(classifyPrompt("에러 나는데 봐줘").errorPaste).toBe(false);
  });

  it("감정 표현과 감사", () => {
    const t = classifyPrompt("고마워!! ㅋㅋ");
    expect(t.emotion).toBe(true);
    expect(t.thanks).toBe(true);
    expect(classifyPrompt("please fix").emotion).toBe(true);
    expect(classifyPrompt("ㅠㅠ 왜").emotion).toBe(true);
    expect(classifyPrompt("🙏").emotion).toBe(true);
    expect(classifyPrompt("thanks").thanks).toBe(true);
    expect(classifyPrompt("미안").thanks).toBe(false);
    expect(classifyPrompt("테스트 돌려").emotion).toBe(false);
  });

  it("20자 이하 명령형", () => {
    expect(classifyPrompt("고쳐").shortImperative).toBe(true);
    expect(classifyPrompt("다시 해줘").shortImperative).toBe(true);
    expect(classifyPrompt("ok").shortImperative).toBe(true);
    expect(classifyPrompt("계속").shortImperative).toBe(true);
    expect(classifyPrompt("fix the lint error").shortImperative).toBe(true);
    expect(classifyPrompt("이거 고쳐?").shortImperative).toBe(false); // 질문
    expect(
      classifyPrompt("이 파일의 함수를 전부 읽고 나서 어떤 식으로 고칠지 설명해줘").shortImperative,
    ).toBe(false); // 길다
    expect(classifyPrompt("음 글쎄").shortImperative).toBe(false);
  });

  it("계획과 방향 전환", () => {
    expect(classifyPrompt("계획 세워").plan).toBe(true);
    expect(classifyPrompt("plan first").plan).toBe(true);
    expect(classifyPrompt("단계별로 가자").plan).toBe(true);
    expect(classifyPrompt("그냥 해").plan).toBe(false);
    const r = classifyPrompt("아니 그게 아니라 다시");
    expect(r.redirect).toBe(true);
    expect(r.redo).toBe(true);
    expect(classifyPrompt("취소").redirect).toBe(true);
    expect(classifyPrompt("되돌려").redirect).toBe(true);
    expect(classifyPrompt("revert that").redirect).toBe(true);
    expect(classifyPrompt("계속 진행").redirect).toBe(false);
    expect(classifyPrompt("계속 진행").redo).toBe(false);
  });

  it("길이는 코드 포인트 수", () => {
    expect(classifyPrompt("한글 abc").length).toBe(6);
    expect(classifyPrompt("  🙏  ").length).toBe(1);
  });
});
