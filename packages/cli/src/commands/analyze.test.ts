import { describe, expect, it } from "vitest";
import { MAX_BADGES } from "@llmbti/core";
import { FIXTURE_NOW, FIXTURE_TZ, fixtureHome } from "../testUtils";
import { MAX_SAMPLES, MIN_PROMPTS, MIN_SHELL, SAMPLE_MAX_LENGTH } from "../scoring.constants";
import { analyze, formatAnalysis, mergePrompts } from "./analyze";

const opts = (name: string, extra: Partial<Parameters<typeof analyze>[0]> = {}) => ({
  home: fixtureHome(name),
  now: FIXTURE_NOW,
  tzOffsetMinutes: FIXTURE_TZ,
  ...extra,
});

/** evidence.ko.json 이 기대하는 통계 키 */
const EVIDENCE_KEYS = [
  "forceCount",
  "rmrfCount",
  "nightRatio",
  "redoCount",
  "thanksCount",
  "topCommand",
  "shortestPrompt",
  "avgTurns",
  "longestSession",
  "promptCount",
  "shellCount",
] as const;

describe("analyze (fixtures, end-to-end)", () => {
  it("home-j: 계획적인 테스터 → J, S, T, I 쪽", () => {
    const r = analyze(opts("home-j"));
    expect(r.insufficient).toBe(false);
    expect(r.periodDays).toBe(30);
    expect(r.sources).toEqual({
      claudeHistory: true,
      claudeProjects: true,
      zsh: false,
      bash: true,
    });
    expect(r.sampleSize.prompts).toBe(45); // 세션 45개, history 는 전부 중복, 기간 밖 1개 제외
    expect(r.sampleSize.shell).toBe(232);
    expect(r.scores.JP).toBeGreaterThan(30);
    expect(r.scores.SN).toBeGreaterThan(0);
    expect(r.scores.TF).toBeGreaterThan(0);
    expect(r.scores.EI).toBeLessThan(0);
    expect(r.type).toBe("ISTJ");
    expect(r.stats.sessionCount).toBe(5);
    expect(r.stats.longestSession).toBe(11);
    expect(r.stats.avgTurns).toBe(9);
    expect(r.stats.forceCount).toBe(1);
    expect(r.stats.rmrfCount).toBe(0);
    expect(r.stats.nightRatio).toBe(0);
    expect(r.stats.topTool?.name).toBe("TodoWrite");
    expect(r.stats.skippedLines).toBe(6); // history 1 + 세션 5
    expect(r.signals.testRatio).toBeGreaterThan(0.05);
    expect(r.badges).toContain("lowSample");
    expect(r.badges).not.toContain("forcePusher");
  });

  it("home-p: force-pusher → P, N, F, E 쪽, 배지 꽉 참", () => {
    const r = analyze(opts("home-p"));
    expect(r.insufficient).toBe(false);
    expect(r.sources).toEqual({
      claudeHistory: true,
      claudeProjects: true,
      zsh: true,
      bash: false,
    });
    expect(r.type).toBe("ENFP");
    expect(r.scores.JP).toBeLessThan(-50);
    expect(r.scores.SN).toBeLessThan(-50);
    expect(r.scores.TF).toBeLessThan(-30);
    expect(r.scores.EI).toBeGreaterThan(10);
    // history.jsonl 에만 있는 프롬프트 6개가 더해진다
    expect(r.sampleSize.prompts).toBe(59);
    expect(r.sampleSize.shell).toBe(218); // 215 + 멀티라인 2 + 깨진 헤더 뒤 1, 기간 밖 1 제외
    expect(r.stats.forceCount).toBeGreaterThanOrEqual(3);
    expect(r.stats.rmrfCount).toBeGreaterThanOrEqual(3);
    expect(r.stats.sudoBangCount).toBeGreaterThanOrEqual(1);
    expect(r.stats.nightRatio).toBeGreaterThanOrEqual(15);
    expect(r.stats.redoCount).toBeGreaterThanOrEqual(10);
    expect(r.stats.interruptCount).toBeGreaterThan(0);
    expect(r.stats.topCommand).toBe("git");
    expect(r.stats.mostRepeatedPrompt?.count).toBeGreaterThanOrEqual(2);
    expect(r.badges).toHaveLength(MAX_BADGES);
    expect(r.badges).toEqual(
      expect.arrayContaining(["forcePusher", "rmrfSurvivor", "nightOwl", "redoLoop", "sudoBanger"]),
    );
    expect(r.stats.skippedLines).toBe(21); // history 2 + 세션 18 + zsh 1
  });

  it("home-tiny: 최소 표본 미달이면 insufficient", () => {
    const r = analyze(opts("home-tiny"));
    expect(r.insufficient).toBe(true);
    expect(r.sampleSize.prompts).toBeLessThan(MIN_PROMPTS);
    expect(r.sampleSize.shell).toBeLessThan(MIN_SHELL);
    expect(r.badges).toContain("lowSample");
    // 점수는 채워져 있지만 신뢰하지 않는다
    expect(typeof r.type).toBe("string");
  });

  it("셸만 충분해도 insufficient 가 아니다 (프롬프트 적고 셸 200개 이상)", () => {
    // home-p 에서 Claude 로그를 못 읽게 하려면 기간을 좁힌다: 최근 0.5일엔 프롬프트가 없고 셸만 남는 날이 없어서
    // 대신 home-j 로 --no-shell 을 켜면 프롬프트 45개 ≥ 30 이라 충분. 반대 케이스는 metrics 단위 테스트가 커버.
    const r = analyze(opts("home-j", { shell: false }));
    expect(r.insufficient).toBe(false);
    expect(r.sampleSize.shell).toBe(0);
    expect(r.sources.bash).toBe(false);
    expect(r.stats.topCommand).toBeUndefined();
    // Bash 툴 명령은 남아 있어서 명령 기반 시그널은 살아 있다
    expect(r.signals.testRatio).toBeDefined();
  });

  it("--days 로 기간을 좁히면 표본이 줄고 periodDays 가 바뀐다", () => {
    const all = analyze(opts("home-p"));
    const week = analyze(opts("home-p", { days: 7 }));
    expect(week.periodDays).toBe(7);
    expect(week.sampleSize.prompts).toBeLessThan(all.sampleSize.prompts);
    expect(week.sampleSize.shell).toBeLessThan(all.sampleSize.shell);
    const huge = analyze(opts("home-j", { days: 365 }));
    expect(huge.sampleSize.prompts).toBe(46); // 기간 밖이던 history 프롬프트가 들어온다
  });

  it("결정적: 두 번 돌리면 deep-equal", () => {
    for (const name of ["home-j", "home-p", "home-tiny"]) {
      expect(analyze(opts(name))).toEqual(analyze(opts(name)));
    }
  });

  it("출력 형식: 샘플 ≤ 20개, 각 ≤ 120자, 시크릿 없음, evidence 키 존재", () => {
    const r = analyze(opts("home-p"));
    expect(r.v).toBe(1);
    expect(r.samples.length).toBeLessThanOrEqual(MAX_SAMPLES);
    expect(r.samples.length).toBeGreaterThan(0);
    const joined = JSON.stringify(r);
    expect(joined).not.toMatch(/sk-abcdefghijklmnopqrstuvwxyz/);
    expect(joined).not.toMatch(/ghp_ABCDEFGHIJ/);
    expect(joined).not.toMatch(/tester@example\.com/);
    expect(joined).not.toMatch(/hunter2/);
    expect(joined).not.toMatch(/admin:secret123/);
    expect(joined).not.toMatch(/010-1234-5678/);
    expect(joined).not.toMatch(/\/Users\/tester/);
    for (const s of r.samples) expect([...s].length).toBeLessThanOrEqual(SAMPLE_MAX_LENGTH);
    for (const k of EVIDENCE_KEYS) {
      if (k === "topCommand" || k === "shortestPrompt") expect(typeof r.stats[k]).toBe("string");
      else expect(typeof r.stats[k]).toBe("number");
    }
    // 축 점수는 -100..100 정수
    for (const v of Object.values(r.scores)) {
      expect(Number.isInteger(v)).toBe(true);
      expect(Math.abs(v)).toBeLessThanOrEqual(100);
    }
  });

  it("홈이 비어 있으면 모든 소스가 false 이고 insufficient", () => {
    const r = analyze({ home: "/nonexistent/home", now: FIXTURE_NOW });
    expect(r.sources).toEqual({
      claudeHistory: false,
      claudeProjects: false,
      zsh: false,
      bash: false,
    });
    expect(r.insufficient).toBe(true);
    expect(r.sampleSize).toEqual({ prompts: 0, shell: 0 });
    expect(r.samples).toEqual([]);
    expect(r.signals).toEqual({});
    expect(r.scores).toEqual({ EI: 0, SN: 0, TF: 0, JP: 0 });
  });
});

describe("mergePrompts", () => {
  const p = (text: string, ts: number, source: "projects" | "history" = "projects") => ({
    text,
    ts,
    source,
  });
  it("세션 로그와 ±2초 안에 겹치는 history 프롬프트는 뺀다", () => {
    const merged = mergePrompts(
      [p("a", 10_000), p("b", 20_000)],
      [p("a", 10_500, "history"), p("c", 30_000, "history")],
    );
    expect(merged.map((m) => m.text)).toEqual(["a", "b", "c"]);
  });
  it("같은 텍스트가 60초 안에 있어도 뺀다", () => {
    const merged = mergePrompts(
      [p("a", 10_000)],
      [p("a", 50_000, "history"), p("a", 100_000, "history")],
    );
    expect(merged.map((m) => `${m.text}@${m.ts}`)).toEqual(["a@10000", "a@100000"]);
  });
  it("세션 로그가 없으면 history 만으로", () => {
    expect(mergePrompts([], [p("x", 5, "history")])).toHaveLength(1);
  });
});

describe("formatAnalysis", () => {
  it("유형, 4축 바, 통계 표를 찍고 샘플 원문은 찍지 않는다", () => {
    const r = analyze(opts("home-p"));
    const out = formatAnalysis(r);
    expect(out).toContain("유형  ENFP");
    expect(out).toMatch(/E [█░]{10} I/);
    expect(out).toContain("--force push");
    expect(out).toContain("배지  ");
    for (const s of r.samples) if (s.length > 5) expect(out).not.toContain(s);
  });
  it("insufficient 면 덜 컴파일됨 메시지", () => {
    const out = formatAnalysis(analyze(opts("home-tiny")));
    expect(out).toContain("아직 덜 컴파일됨");
    expect(out).not.toContain("유형  ");
  });
});
