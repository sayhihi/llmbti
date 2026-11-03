import { describe, expect, it } from "vitest";
import type { PromptEvent, SessionLog } from "../parsers/common";
import { computeMetrics } from "./index";
import { hourOf, hourStats } from "./time";

const KST = 540;
/** 2026-10-20 KST 기준 hour 시 */
const at = (hour: number, minute = 0) =>
  Date.parse("2026-10-20T00:00:00+09:00") + hour * 3_600_000 + minute * 60_000;

function prompt(text: string, ts: number, sessionId = "s1"): PromptEvent {
  return { text, ts, sessionId, source: "projects" };
}

function session(
  sessionId: string,
  prompts: PromptEvent[],
  extra: Partial<SessionLog> = {},
): SessionLog {
  return {
    sessionId,
    prompts,
    interruptMarkers: 0,
    toolUses: {},
    bashCommands: [],
    planSignals: 0,
    ...extra,
  };
}

describe("time", () => {
  it("hourOf 는 tz 오프셋을 따른다", () => {
    const ts = Date.parse("2026-10-20T03:30:00+09:00");
    expect(hourOf(ts, KST)).toBe(3);
    expect(hourOf(ts, 0)).toBe(18);
  });

  it("hourStats: 피크 시간(동점이면 이른 시간)과 새벽 비율", () => {
    const s = hourStats([at(3), at(3, 10), at(14), at(14, 5), at(5), at(23)], KST);
    expect(s.peakHour).toBe(3);
    expect(s.nightRatio).toBeCloseTo(3 / 6);
    expect(hourStats([], KST).peakHour).toBeUndefined();
    expect(hourStats([], KST).nightRatio).toBe(0);
  });
});

describe("computeMetrics", () => {
  it("빈 입력이면 시그널은 비고 통계는 0", () => {
    const m = computeMetrics({
      prompts: [],
      sessions: [],
      shell: [],
      shellEnabled: false,
      tzOffsetMinutes: KST,
    });
    expect(m.signals).toEqual({});
    expect(m.stats.promptCount).toBe(0);
    expect(m.stats.shellCount).toBe(0);
    expect(m.stats.avgTurns).toBe(0);
    expect(m.stats.longestSession).toBe(0);
    expect(m.stats.peakHour).toBeUndefined();
    expect(m.stats.shortestPrompt).toBeUndefined();
    expect(m.stats.topCommand).toBeUndefined();
    expect(m.stats.topTool).toBeUndefined();
  });

  it("세션, 프롬프트, 셸을 합쳐 시그널과 통계를 낸다", () => {
    const s1 = session(
      "s1",
      [
        prompt("이거 왜 안 돼?", at(3)),
        prompt("다시", at(3, 5)),
        prompt("고마워 ㅋㅋ", at(3, 10)),
        prompt("다시", at(3, 15)),
      ],
      {
        interruptMarkers: 1,
        toolUses: { Bash: 3, Read: 5 },
        bashCommands: ["pnpm test", "git push --force"],
        planSignals: 1,
      },
    );
    const s2 = session(
      "s2",
      [prompt("src/a.ts:10 고쳐", at(14), "s2"), prompt("계획 세워서 해", at(14, 1), "s2")],
      {
        toolUses: { Bash: 4 },
      },
    );
    const empty = session("s3", []);
    const prompts = [...s1.prompts, ...s2.prompts];
    const shell = [
      { command: "git status", ts: at(15) },
      { command: "git push -f", ts: at(15, 1) },
      { command: "rm -rf dist", ts: at(2) },
      { command: "sudo !!" },
      { command: 'git commit -m "wip"' },
      { command: 'git commit -m "feat: real"' },
      { command: "pnpm test" },
      { command: "ls" },
    ];
    const m = computeMetrics({
      prompts,
      sessions: [s1, s2, empty],
      shell,
      shellEnabled: true,
      tzOffsetMinutes: KST,
    });

    expect(m.signals.avgTurns).toBe(3); // (4+2)/2, 빈 세션 제외
    expect(m.signals.questionRatio).toBeCloseTo(1 / 6);
    expect(m.signals.interruptRatio).toBeCloseTo(1 / 6); // 마커 1개
    expect(m.signals.concreteRatio).toBeCloseTo(1 / 6);
    expect(m.signals.emotionRatio).toBeCloseTo(1 / 6);
    expect(m.signals.planRatio).toBeCloseTo(2 / 6); // 키워드 1 + planSignals 1
    expect(m.signals.redirectRatio).toBeCloseTo(2 / 6);
    // 명령 풀 = 셸 8 + Bash 툴 2 = 10
    expect(m.signals.testRatio).toBeCloseTo(2 / 10);
    expect(m.signals.forceRatio).toBeCloseTo(3 / 10);
    expect(m.signals.lowQualityCommitRatio).toBeCloseTo(1 / 2);

    expect(m.stats).toMatchObject({
      promptCount: 6,
      shellCount: 8,
      sessionCount: 2,
      avgTurns: 3,
      longestSession: 4,
      peakHour: 3,
      forceCount: 2,
      rmrfCount: 1,
      sudoBangCount: 1,
      topCommand: "git",
      shortestPrompt: "다시",
      mostRepeatedPrompt: { text: "다시", count: 2 },
      redoCount: 2,
      thanksCount: 1,
      interruptCount: 1,
      topTool: { name: "Bash", count: 7 },
      skippedLines: 0,
    });
    expect(m.stats.topCommands).toEqual([
      { command: "git", count: 4 },
      { command: "ls", count: 1 },
      { command: "pnpm", count: 1 },
      { command: "rm", count: 1 },
      { command: "sudo", count: 1 },
    ]);
    // 새벽: 프롬프트 4개(3시) + 셸 ts 있는 3개 중 1개(2시) = 5/9
    expect(m.stats.nightRatio).toBe(Math.round((5 / 9) * 100));
    expect(m.classified).toHaveLength(6);
    expect(m.classified.filter((c) => c.night)).toHaveLength(4);
  });

  it("셸도 Bash 툴도 없으면 명령 기반 시그널이 빠진다", () => {
    const m = computeMetrics({
      prompts: [prompt("hi", at(10))],
      sessions: [session("s1", [prompt("hi", at(10))])],
      shell: [],
      shellEnabled: false,
      tzOffsetMinutes: KST,
    });
    expect(m.signals.testRatio).toBeUndefined();
    expect(m.signals.forceRatio).toBeUndefined();
    expect(m.signals.lowQualityCommitRatio).toBeUndefined();
    expect("testRatio" in m.signals).toBe(false);
    expect(m.signals.avgTurns).toBe(1);
  });
});
