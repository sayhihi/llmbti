import { describe, expect, it } from "vitest";

import { splitAiLog } from "./AiLog";

describe("splitAiLog", () => {
  it("끝의 I believe... 를 떼어 낸다", () => {
    expect(
      splitAiLog("우리 애는요... 다시를 147번 했지만 더 좋은 답을 찾고 싶어서였어요. I believe..."),
    ).toEqual({
      body: "우리 애는요... 다시를 147번 했지만 더 좋은 답을 찾고 싶어서였어요.",
      believe: true,
    });
  });

  it("대소문자, 말줄임표 모양이 달라도 잡는다", () => {
    expect(splitAiLog("우리 애는요... 3번. i Believe…").believe).toBe(true);
    expect(splitAiLog("우리 애는요... 3번. I believe").believe).toBe(true);
  });

  it("끝에 없으면 통째로 본문", () => {
    expect(splitAiLog("I believe 로 시작만 했다 3번")).toEqual({
      body: "I believe 로 시작만 했다 3번",
      believe: false,
    });
  });
});
