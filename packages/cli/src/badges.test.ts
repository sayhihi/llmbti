import { describe, expect, it } from "vitest";
import { MAX_BADGES } from "@llmbit/core";
import type { Stats } from "@llmbit/core";
import { isLowSample, pickBadges } from "./badges";
import { BADGE_THRESHOLDS, LOW_SAMPLE_PROMPTS } from "./scoring.constants";

function stats(partial: Partial<Stats> = {}): Stats {
  return {
    promptCount: 100,
    shellCount: 300,
    sessionCount: 10,
    avgTurns: 10,
    longestSession: 10,
    nightRatio: 0,
    forceCount: 0,
    rmrfCount: 0,
    sudoBangCount: 0,
    topCommands: [],
    redoCount: 0,
    thanksCount: 0,
    interruptCount: 0,
    skippedLines: 0,
    ...partial,
  };
}

describe("pickBadges", () => {
  it("아무 기준도 못 넘기면 빈 배열", () => {
    expect(pickBadges(stats(), false)).toEqual([]);
  });

  it("기준을 넘긴 배지를 규칙 순서대로, lowSample 은 맨 앞", () => {
    const s = stats({
      forceCount: BADGE_THRESHOLDS.forcePusher,
      nightRatio: BADGE_THRESHOLDS.nightOwl,
      shortestPrompt: "ㅇㅇ",
    });
    expect(pickBadges(s, true)).toEqual(["lowSample", "forcePusher", "nightOwl", "oneWordWonder"]);
    expect(pickBadges(s, false)).toEqual(["forcePusher", "nightOwl", "oneWordWonder"]);
  });

  it("경계값 바로 아래는 안 준다", () => {
    const s = stats({
      forceCount: BADGE_THRESHOLDS.forcePusher - 1,
      rmrfCount: BADGE_THRESHOLDS.rmrfSurvivor - 1,
      nightRatio: BADGE_THRESHOLDS.nightOwl - 1,
      redoCount: BADGE_THRESHOLDS.redoLoop - 1,
      thanksCount: BADGE_THRESHOLDS.thankYouBot - 1,
      longestSession: BADGE_THRESHOLDS.marathonSession - 1,
      sudoBangCount: 0,
      shortestPrompt: "네 글자다",
    });
    expect(pickBadges(s, false)).toEqual([]);
  });

  it("최대 MAX_BADGES 개", () => {
    const s = stats({
      forceCount: 99,
      rmrfCount: 99,
      nightRatio: 99,
      redoCount: 99,
      thanksCount: 99,
      longestSession: 99,
      sudoBangCount: 99,
      shortestPrompt: "ㅇ",
    });
    const b = pickBadges(s, true);
    expect(b).toHaveLength(MAX_BADGES);
    expect(b[0]).toBe("lowSample");
    expect(new Set(b).size).toBe(b.length);
  });

  it("isLowSample", () => {
    expect(isLowSample(LOW_SAMPLE_PROMPTS - 1)).toBe(true);
    expect(isLowSample(LOW_SAMPLE_PROMPTS)).toBe(false);
  });
});
