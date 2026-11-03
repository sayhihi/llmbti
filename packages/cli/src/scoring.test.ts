import { describe, expect, it } from "vitest";
import type { Signals } from "@llmbti/core";
import { displayType, normalizeSignal, score, scoreAxis } from "./scoring";
import { BORDERLINE, SIGNALS } from "./scoring.constants";

/** 모든 시그널을 기준값으로 두면 모든 축이 0이다. */
function baselineSignals(): Required<Signals> {
  const out = {} as Required<Signals>;
  for (const [key, spec] of Object.entries(SIGNALS)) out[key as keyof Signals] = spec.baseline;
  return out;
}

describe("normalizeSignal", () => {
  it("기준값이면 0, 스케일만큼 벗어나면 ±1, 그 밖은 clamp", () => {
    expect(normalizeSignal("avgTurns", 8)).toBe(0);
    expect(normalizeSignal("avgTurns", 16)).toBe(1);
    expect(normalizeSignal("avgTurns", 0)).toBe(-1);
    expect(normalizeSignal("avgTurns", 1000)).toBe(1);
    expect(normalizeSignal("questionRatio", 0.375)).toBeCloseTo(0.5);
  });
});

describe("score", () => {
  it("기준값이면 전부 0점이고 동점은 앞 글자 → ESTJ, 모든 축 경계형", () => {
    const r = score(baselineSignals());
    expect(r.scores).toEqual({ EI: 0, SN: 0, TF: 0, JP: 0 });
    expect(r.type).toBe("ESTJ");
    expect(r.borderline).toEqual(["EI", "SN", "TF", "JP"]);
    expect(displayType(r)).toBe("????");
  });

  it("방향: 턴 많고 질문 많으면 E, 길면 I", () => {
    const s = baselineSignals();
    s.avgTurns = 100;
    s.questionRatio = 1;
    expect(scoreAxis("EI", s)).toBeGreaterThan(0);
    const t = baselineSignals();
    t.avgPromptLength = 10_000;
    expect(scoreAxis("EI", t)).toBeLessThan(0);
    const u = baselineSignals();
    u.emotionRatio = 1;
    expect(scoreAxis("TF", u)).toBeLessThan(0);
    const v = baselineSignals();
    v.forceRatio = 0.5;
    v.redirectRatio = 1;
    expect(scoreAxis("JP", v)).toBeLessThan(0);
    const w = baselineSignals();
    w.abstractRatio = 1;
    expect(scoreAxis("SN", w)).toBeLessThan(0);
  });

  it("극단값이면 ±100 정수", () => {
    const s = baselineSignals();
    s.avgTurns = 1e6;
    s.questionRatio = 1;
    s.avgPromptLength = 0;
    s.interruptRatio = 1;
    expect(scoreAxis("EI", s)).toBe(100);
    s.avgTurns = 0;
    s.questionRatio = 0;
    s.avgPromptLength = 1e6;
    s.interruptRatio = 0;
    expect(scoreAxis("EI", s)).toBe(-100);
    for (const v of Object.values(score(s).scores)) expect(Number.isInteger(v)).toBe(true);
  });

  it("결정적: 같은 입력이면 deep-equal", () => {
    const s: Signals = {
      avgTurns: 5.5,
      questionRatio: 0.31,
      avgPromptLength: 77,
      interruptRatio: 0.04,
      concreteRatio: 0.2,
      abstractRatio: 0.3,
      errorPasteRatio: 0.05,
      emotionRatio: 0.2,
      shortImperativeRatio: 0.1,
      planRatio: 0.3,
      testRatio: 0.02,
      forceRatio: 0.03,
      redirectRatio: 0.2,
      lowQualityCommitRatio: 0.5,
    };
    expect(score(s)).toEqual(score(JSON.parse(JSON.stringify(s))));
  });

  it("셸 시그널이 없으면 나머지 가중치를 재정규화한다", () => {
    // planRatio 만 있고 극단값이면 JP = +100 (가중치 0.25 → 1.0 으로 재정규화)
    expect(scoreAxis("JP", { planRatio: 1 })).toBe(100);
    // 시그널이 둘일 때: plan +1 (0.25), redirect -1 (0.15, sign -1 → 기여 -(-1)... )
    // redirectRatio 0 → norm -1, sign -1 → +1. 둘 다 +1 이면 100.
    expect(scoreAxis("JP", { planRatio: 1, redirectRatio: 0 })).toBe(100);
    // plan +1(0.25), redirect: 0.2 → norm +1, sign -1 → -1 (0.15) => (0.25 - 0.15)/0.4 = 0.25 → 25
    expect(scoreAxis("JP", { planRatio: 1, redirectRatio: 0.2 })).toBe(25);
    // 셸 포함 전체: 같은 값이면 셸 시그널이 기준값이라 0 기여, 가중치 분모만 커져서 절대값이 줄어든다
    const full = scoreAxis("JP", {
      planRatio: 1,
      redirectRatio: 0.2,
      testRatio: 0.05,
      forceRatio: 0.01,
      lowQualityCommitRatio: 0.2,
    });
    expect(full).toBe(10); // (0.25 - 0.15) / 1.0
  });

  it("시그널이 하나도 없는 축은 0", () => {
    expect(scoreAxis("SN", {})).toBe(0);
    expect(score({}).type).toBe("ESTJ");
  });

  it("경계형: |점수| < BORDERLINE", () => {
    // EI 만 살짝 양수로
    const s = baselineSignals();
    s.avgTurns = 8 + 8 * 0.1; // norm 0.1 * weight 0.3 = 0.03 → 3점
    const r = score(s);
    expect(r.scores.EI).toBe(3);
    expect(Math.abs(r.scores.EI)).toBeLessThan(BORDERLINE);
    expect(r.borderline).toContain("EI");
    expect(r.type.startsWith("E")).toBe(true);
    expect(displayType(r).startsWith("?")).toBe(true);

    s.avgTurns = 8 + 8 * 0.5; // 15점
    const r2 = score(s);
    expect(r2.scores.EI).toBe(15);
    expect(r2.borderline).not.toContain("EI");
    expect(displayType(r2).startsWith("E")).toBe(true);
  });
});
