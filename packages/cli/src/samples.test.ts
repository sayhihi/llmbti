import { describe, expect, it } from "vitest";
import type { ClassifiedPrompt } from "./metrics";
import { classifyPrompt } from "./metrics/prompts";
import { pickSamples } from "./samples";
import { MAX_SAMPLES, SAMPLE_MAX_LENGTH } from "./scoring.constants";

function cp(text: string, night = false): ClassifiedPrompt {
  return {
    prompt: { text, ts: 0, source: "history" },
    flags: classifyPrompt(text),
    hour: night ? 3 : 14,
    night,
  };
}

describe("pickSamples", () => {
  it("빈 입력이면 빈 배열", () => {
    expect(pickSamples([])).toEqual([]);
  });

  it("짧은 것 → 반복 → 새벽 → 방향 전환 → 감정 순으로 뽑고 중복은 없다", () => {
    const cs = [
      cp("긴 프롬프트인데 특별한 건 없는 일반 요청입니다 길게 길게"),
      cp("a"),
      cp("bb"),
      cp("반복"),
      cp("반복"),
      cp("반복"),
      cp("새벽에 쓴 프롬프트", true),
      cp("아니 그게 아니라 다시 해줘"),
      cp("고마워 ㅋㅋ"),
    ];
    const out = pickSamples(cs);
    expect(out[0]).toBe("a");
    expect(out[1]).toBe("bb");
    expect(out).toContain("반복");
    expect(out).toContain("새벽에 쓴 프롬프트");
    expect(out).toContain("아니 그게 아니라 다시 해줘");
    expect(out).toContain("고마워 ㅋㅋ");
    expect(new Set(out).size).toBe(out.length);
    expect(out.filter((s) => s === "반복")).toHaveLength(1);
  });

  it("최대 MAX_SAMPLES 개, 각 SAMPLE_MAX_LENGTH 자 이하, redact 통과", () => {
    const cs: ClassifiedPrompt[] = [];
    for (let i = 0; i < 100; i++)
      cs.push(cp(`프롬프트 ${i} sk-abcdefghijklmnopqrstuvwxyz${i}000000 ` + "x".repeat(i * 3)));
    const out = pickSamples(cs, { home: "/Users/tester" });
    expect(out.length).toBe(MAX_SAMPLES);
    for (const s of out) {
      expect([...s].length).toBeLessThanOrEqual(SAMPLE_MAX_LENGTH);
      expect(s).not.toMatch(/sk-abc/);
      expect(s).toContain("[SK_TOKEN]");
    }
  });

  it("결정적: 입력 순서를 섞어도 같은 결과", () => {
    const texts = [
      "c",
      "a",
      "b",
      "반복",
      "반복",
      "고마워",
      "다시",
      "긴 프롬프트 하나 더 넣어 봅니다",
    ];
    const a = pickSamples(texts.map((t) => cp(t)));
    const b = pickSamples([...texts].reverse().map((t) => cp(t)));
    expect(a).toEqual(b);
  });
});
