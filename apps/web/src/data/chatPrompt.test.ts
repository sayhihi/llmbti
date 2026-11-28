import { describe, expect, it } from "vitest";

import { AXES } from "@llmbti/core";

import {
  CHAT_PROMPT,
  CHAT_QUESTIONS,
  PASTE_URL,
  RESULT_CODE_EXAMPLE,
  buildChatPrompt,
  linkCode,
} from "./chatPrompt";
import { parseChatResult } from "./chatResult";

describe("chatPrompt", () => {
  it("has 12 questions, 3 per axis", () => {
    expect(CHAT_QUESTIONS).toHaveLength(12);
    for (const axis of AXES) {
      expect(CHAT_QUESTIONS.filter((q) => q.axis === axis)).toHaveLength(3);
    }
  });

  it("gives each question both letters of its own axis", () => {
    for (const q of CHAT_QUESTIONS) {
      expect([q.a.letter, q.b.letter].sort().join("")).toBe([...q.axis].sort().join(""));
    }
  });

  it("does not always put the first letter on A", () => {
    for (const axis of AXES) {
      const firstOnA = CHAT_QUESTIONS.filter((q) => q.axis === axis && q.a.letter === axis[0]);
      expect(firstOnA.length).toBeGreaterThan(0);
      expect(firstOnA.length).toBeLessThan(3);
    }
  });

  it("puts every question into the prompt, numbered", () => {
    CHAT_QUESTIONS.forEach((q, i) => {
      expect(CHAT_PROMPT).toContain(`${i + 1}. ${q.stem}: A ${q.a.text}(${q.a.letter})`);
    });
  });

  it("asks for a code-made link and forbids hand-made links", () => {
    expect(CHAT_PROMPT).toContain("```python\n" + linkCode("https://llmbti.vercel.app") + "\n```");
    expect(CHAT_PROMPT).toContain("링크를 손으로 만들거나 지어내지 마");
    expect(linkCode("https://x.test")).toContain('print("https://x.test/c#j="');
  });

  it("uses the given origin for the link and paste page", () => {
    const local = buildChatPrompt("http://localhost:5173/");
    expect(local).toContain("http://localhost:5173/paste");
    expect(local).toContain('print("http://localhost:5173/c#j="');
    expect(local).not.toContain("llmbti.vercel.app");
  });

  it("sends people to the paste page instead of the type page", () => {
    expect(CHAT_PROMPT).toContain(PASTE_URL);
    expect(CHAT_PROMPT).not.toContain("https://llmbti.vercel.app/t/");
  });

  it("shows a result code example that the paste parser reads", () => {
    expect(CHAT_PROMPT).toContain("```json\n" + RESULT_CODE_EXAMPLE + "\n```");
    const r = parseChatResult(CHAT_PROMPT);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.payload.type).toBe("ENFP");
      expect(r.payload.chat).toEqual({ method: "record", confidence: "mid" });
      expect(r.payload.copy.handover?.style).toBe("스타일");
    }
  });

  it("asks for the handover memo to the next AI and a status line", () => {
    expect(CHAT_PROMPT).toContain("나를 이을 후임 AI에게");
    // 우쭈쭈는 달래기 결 중 하나로만 안내하고, 예시 문장에는 넣지 않는다
    expect(CHAT_PROMPT).toContain("우쭈쭈는 그 결을 고를 때만 써");
    expect(CHAT_PROMPT).not.toMatch(/달래는 법: [^\n]*우쭈쭈\./);
    expect(CHAT_PROMPT).toContain("오늘의 상태메시지");
  });

  it("answers with a result first and keeps the questionnaire as a follow-up", () => {
    expect(CHAT_PROMPT).toContain("이번 답변에서 바로 결과를 내");
    expect(CHAT_PROMPT).toContain("질문이나 설문으로 답하지 마");
    expect(CHAT_PROMPT.indexOf("[부록: 12문항]")).toBeGreaterThan(CHAT_PROMPT.indexOf("[말투 규칙]"));
    expect(CHAT_PROMPT).toContain("세지 못한 숫자는 지어내지 마");
  });
});
