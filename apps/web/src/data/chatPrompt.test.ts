import { describe, expect, it } from "vitest";

import { AXES } from "@llmbti/core";

import { CHAT_PROMPT, CHAT_QUESTIONS } from "./chatPrompt";

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

  it("ends with the type page link rule", () => {
    expect(CHAT_PROMPT).toContain("https://llmbti.vercel.app/t/");
  });

  it("answers with a result first and keeps the questionnaire as a follow-up", () => {
    expect(CHAT_PROMPT).toContain("이번 답변에서 바로 결과를 내");
    expect(CHAT_PROMPT).toContain("질문이나 설문으로 답하지 마");
    expect(CHAT_PROMPT.indexOf("[부록: 12문항]")).toBeGreaterThan(CHAT_PROMPT.indexOf("[말투 규칙]"));
    expect(CHAT_PROMPT).toContain("세지 못한 숫자는 지어내지 마");
  });
});
