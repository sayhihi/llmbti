import { describe, expect, it } from "vitest";

import {
  countSentences,
  findEmoji,
  formatProblems,
  hasEmoji,
  mapCopyStrings,
  validateCopy,
} from "./validate";

const good = {
  lang: "ko",
  nickname: "새벽 force push 직배포러",
  roast:
    "--force push 11번, 그중 7번이 새벽 3시다. 브랜치를 안 따고 main에서 쏘는데 그마저도 힘으로 민다. 커밋 메시지 절반이 fix인 건 솔직해서 좋다.",
  evidence: ["--force push 11번", "새벽 2시에서 5시 사이 활동 34%", "커밋 메시지 중 fix 48%"],
  commitMessage: "fix: prod again",
  pairWith: { type: "INFJ", reason: "쏘고 나면 문서는 저쪽이 써 줌" },
};

function problemsOf(patch: Record<string, unknown>): string[] {
  const r = validateCopy({ ...good, ...patch });
  return r.ok ? [] : r.problems;
}

describe("validateCopy", () => {
  it("좋은 예는 통과한다", () => {
    const r = validateCopy(good);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.copy.pairWith.type).toBe("INFJ");
  });

  it("객체가 아니면 실패", () => {
    expect(validateCopy("x").ok).toBe(false);
    expect(validateCopy(null).ok).toBe(false);
  });

  it("lang", () => {
    expect(problemsOf({ lang: "jp" })).toEqual([expect.stringContaining("lang")]);
  });

  it("nickname 20자 초과", () => {
    expect(problemsOf({ nickname: "가".repeat(21) })).toEqual([
      expect.stringContaining("nickname: 20자 이하"),
    ]);
    expect(problemsOf({ nickname: "가".repeat(20) })).toEqual([]);
  });

  it("roast 200자 초과, 문장 수", () => {
    expect(problemsOf({ roast: "가".repeat(150) + ". " + "나".repeat(60) + "." })).toEqual([
      expect.stringContaining("roast: 200자 이하"),
    ]);
    expect(problemsOf({ roast: "한 문장이다 11번." })).toEqual([
      expect.stringContaining("roast: 2~3문장"),
    ]);
    expect(problemsOf({ roast: "하나. 둘. 셋. 넷 4번." })).toEqual([
      expect.stringContaining("지금 4문장"),
    ]);
    // 소수점은 문장으로 안 센다
    expect(problemsOf({ roast: "프롬프트 평균 2.1자. 고쳐로 한 달을 버텼다." })).toEqual([]);
  });

  it("evidence 개수, 길이, 숫자", () => {
    expect(problemsOf({ evidence: ["1번", "2번"] })).toEqual([
      expect.stringContaining("정확히 3개"),
    ]);
    expect(problemsOf({ evidence: ["1번", "2번", "가".repeat(61)] })).toEqual([
      expect.stringContaining("evidence[3]: 60자 이하"),
      expect.stringContaining("evidence[3]: 숫자"),
    ]);
    expect(problemsOf({ evidence: ["숫자 없음", "2번", "3번"] })).toEqual([
      expect.stringContaining("evidence[1]: 숫자"),
    ]);
    expect(problemsOf({ evidence: "no" })).toEqual([expect.stringContaining("배열")]);
  });

  it("commitMessage 50자 초과", () => {
    expect(problemsOf({ commitMessage: "f".repeat(51) })).toEqual([
      expect.stringContaining("commitMessage: 50자"),
    ]);
  });

  it("pairWith type, reason", () => {
    expect(problemsOf({ pairWith: { type: "ABCD", reason: "x" } })).toEqual([
      expect.stringContaining("pairWith.type"),
    ]);
    expect(problemsOf({ pairWith: { type: "INTJ", reason: "가".repeat(41) } })).toEqual([
      expect.stringContaining("pairWith.reason: 40자"),
    ]);
    expect(problemsOf({ pairWith: "INTJ" })).toEqual([expect.stringContaining("pairWith")]);
  });

  it("가운뎃점과 줄표는 어느 필드든 거부", () => {
    expect(problemsOf({ nickname: "리베이스·장인" })).toEqual([
      expect.stringContaining("nickname: 가운뎃점"),
    ]);
    expect(problemsOf({ roast: "다시 38번 — 틀린 게 아니다. 더 재밌는 길이다." })).toEqual([
      expect.stringContaining("roast: 줄표"),
    ]);
    expect(problemsOf({ evidence: ["1번 – 둘", "2번", "3번"] })).toEqual([
      expect.stringContaining("evidence[1]: 줄표"),
    ]);
    expect(problemsOf({ pairWith: { type: "INTJ", reason: "a • b" } })).toEqual([
      expect.stringContaining("pairWith.reason: 불릿"),
    ]);
  });

  it("이모지는 어느 필드든 거부", () => {
    expect(problemsOf({ nickname: "리베이스 장인 🔥" })).toEqual([
      expect.stringContaining("nickname: 이모지 금지 (🔥)"),
    ]);
    expect(problemsOf({ roast: "다시 38번 😂😂. 틀린 게 아니다 🫠." })).toEqual([
      expect.stringContaining("roast: 이모지 금지 (😂 🫠)"),
    ]);
    expect(problemsOf({ evidence: ["1번 ✅", "2번", "3번"] })).toEqual([
      expect.stringContaining("evidence[1]: 이모지"),
    ]);
    expect(problemsOf({ commitMessage: "✨ feat: sparkle" })).toEqual([
      expect.stringContaining("commitMessage: 이모지"),
    ]);
    expect(problemsOf({ pairWith: { type: "INTJ", reason: "👍 같이 하면 됨" } })).toEqual([
      expect.stringContaining("pairWith.reason: 이모지"),
    ]);
    // 바 문자, 한글, 숫자, 문장부호는 이모지가 아니다
    expect(problemsOf({ nickname: "█░ 50% 장인?!" })).toEqual([]);
  });

  it("빈 문자열과 타입 오류", () => {
    expect(problemsOf({ nickname: "  " })).toEqual([expect.stringContaining("비어")]);
    expect(problemsOf({ roast: 3 })).toEqual([expect.stringContaining("문자열")]);
  });

  it("문제를 전부 모아서 돌려준다", () => {
    const r = validateCopy({});
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.problems.length).toBeGreaterThanOrEqual(6);
      const text = formatProblems(r.problems);
      expect(text.startsWith("1. ")).toBe(true);
      expect(text.trim().split("\n")).toHaveLength(r.problems.length);
    }
  });
});

describe("countSentences", () => {
  it("문장부호 뒤 공백 또는 끝", () => {
    expect(countSentences("하나. 둘. 셋.")).toBe(3);
    expect(countSentences("하나. 둘")).toBe(2);
    expect(countSentences("2.1자 평균. 끝!")).toBe(2);
    expect(countSentences("물음표? 느낌표! 마침표.")).toBe(3);
    expect(countSentences("")).toBe(0);
    expect(countSentences("문장부호 없음")).toBe(1);
  });
});

describe("hasEmoji / findEmoji", () => {
  it("Extended_Pictographic 만 잡는다", () => {
    expect(hasEmoji("fix: prod again")).toBe(false);
    expect(hasEmoji("E ████░░ I")).toBe(false);
    expect(hasEmoji("배포 🚀")).toBe(true);
    expect(findEmoji("🚀 가고 🚀 또 🔥")).toEqual(["🚀", "🔥"]);
    expect(findEmoji("없음")).toEqual([]);
  });
});

describe("mapCopyStrings", () => {
  it("모든 문자열 필드에 적용하고 type은 그대로", () => {
    const r = validateCopy(good);
    if (!r.ok) throw new Error("fixture invalid");
    const mapped = mapCopyStrings(r.copy, (s) => s.toUpperCase());
    expect(mapped.nickname).toBe(good.nickname.toUpperCase());
    expect(mapped.evidence[1]).toBe(good.evidence[1]!.toUpperCase());
    expect(mapped.pairWith).toEqual({ type: "INFJ", reason: good.pairWith.reason.toUpperCase() });
    expect(mapped.lang).toBe("ko");
  });
});
