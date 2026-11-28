import { describe, expect, it } from "vitest";

import { splitAiLog } from "./AiLog";

describe("splitAiLog", () => {
  it("후임에게: 뒤를 떼어 낸다", () => {
    expect(splitAiLog("다시를 147번 들었다. 후임에게: 처음 세 번은 무시해도 된다.")).toEqual({
      body: "다시를 147번 들었다.",
      handoff: "처음 세 번은 무시해도 된다.",
    });
  });

  it("후임에게: 가 없거나 뒤가 비면 통째로 본문", () => {
    expect(splitAiLog("고마워를 58번 들었다.")).toEqual({
      body: "고마워를 58번 들었다.",
      handoff: null,
    });
    expect(splitAiLog("3번 들었다. 후임에게:")).toEqual({
      body: "3번 들었다. 후임에게:",
      handoff: null,
    });
  });
});
