/**
 * 시그널 + 재미용 통계 집계 (SPEC 6장).
 * 입력은 이미 분석 기간으로 걸러진 이벤트다. 출력의 문자열 통계는 아직 redact 전이다 (analyze가 처리).
 */

import type { Signals, Stats } from "@llmbit/core";
import type { PromptEvent, SessionLog, ShellEvent } from "../parsers/common";
import { MIN_REPEAT_COUNT } from "../scoring.constants";
import { classifyPrompt, type PromptFlags } from "./prompts";
import { classifyCommand, isForceful } from "./shell";
import { hourOf, hourStats, isNightHour } from "./time";

export interface MetricsInput {
  prompts: PromptEvent[];
  sessions: SessionLog[];
  shell: ShellEvent[];
  /** 셸 히스토리를 읽었는지 (파일이 있고 --no-shell이 아닐 때) */
  shellEnabled: boolean;
  tzOffsetMinutes?: number;
}

export interface ClassifiedPrompt {
  prompt: PromptEvent;
  flags: PromptFlags;
  hour: number;
  night: boolean;
}

export interface MetricsOutput {
  signals: Signals;
  /** 문자열 필드는 redact 전 원문 */
  stats: Stats;
  classified: ClassifiedPrompt[];
}

function ratio(n: number, d: number): number | undefined {
  return d === 0 ? undefined : n / d;
}

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

export function computeMetrics(input: MetricsInput): MetricsOutput {
  const { prompts, sessions, shell, tzOffsetMinutes } = input;

  const classified: ClassifiedPrompt[] = prompts.map((prompt) => {
    const hour = hourOf(prompt.ts, tzOffsetMinutes);
    return { prompt, flags: classifyPrompt(prompt.text), hour, night: isNightHour(hour) };
  });
  const n = classified.length;
  const count = (pick: (f: PromptFlags) => boolean) =>
    classified.reduce((acc, c) => acc + (pick(c.flags) ? 1 : 0), 0);

  // 세션
  const liveSessions = sessions.filter((s) => s.prompts.length > 0);
  const sessionTurns = liveSessions.map((s) => s.prompts.length);
  const avgTurnsRaw =
    sessionTurns.length === 0
      ? undefined
      : sessionTurns.reduce((a, b) => a + b, 0) / sessionTurns.length;
  const longestSession = sessionTurns.length === 0 ? 0 : Math.max(...sessionTurns);
  const interruptMarkers = sessions.reduce((a, s) => a + s.interruptMarkers, 0);
  const planSignals = sessions.reduce((a, s) => a + s.planSignals, 0);
  const toolTotals = new Map<string, number>();
  for (const s of sessions) {
    for (const [name, c] of Object.entries(s.toolUses)) {
      toolTotals.set(name, (toolTotals.get(name) ?? 0) + c);
    }
  }
  const topTool = [...toolTotals.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  )[0];

  // 명령 풀: 셸 히스토리 + Claude Bash 툴
  const bashToolCommands = sessions.flatMap((s) => s.bashCommands);
  const pool = [...shell.map((s) => s.command), ...bashToolCommands].map(classifyCommand);
  const commits = pool.filter((c) => c.commitMessage !== undefined);
  const shellFlags = shell.map((s) => classifyCommand(s.command));

  // 셸 top 명령 (셸 히스토리만, 인자 제외)
  const nameCounts = new Map<string, number>();
  for (const c of shellFlags) {
    if (!c.name) continue;
    nameCounts.set(c.name, (nameCounts.get(c.name) ?? 0) + 1);
  }
  const topCommands = [...nameCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([command, count]) => ({ command, count }));

  // 시간대: 프롬프트 + ts 있는 셸 명령
  const timestamps = [
    ...prompts.map((p) => p.ts),
    ...shell.map((s) => s.ts).filter((t): t is number => t !== undefined),
  ];
  const hours = hourStats(timestamps, tzOffsetMinutes);

  // 짧은 프롬프트 / 반복 프롬프트
  const byLength = [...classified].sort(
    (a, b) => a.flags.length - b.flags.length || a.prompt.text.localeCompare(b.prompt.text),
  );
  const shortest = byLength[0]?.prompt.text;
  const repeats = new Map<string, number>();
  for (const c of classified) {
    const key = c.prompt.text.trim();
    repeats.set(key, (repeats.get(key) ?? 0) + 1);
  }
  const mostRepeated = [...repeats.entries()]
    .filter(([, c]) => c >= MIN_REPEAT_COUNT)
    .sort((a, b) => b[1] - a[1] || a[0].length - b[0].length || a[0].localeCompare(b[0]))[0];

  const interruptPrompts = count((f) => f.interrupt);
  const planPrompts = count((f) => f.plan);

  const signals: Signals = {
    avgTurns: avgTurnsRaw,
    questionRatio: ratio(
      count((f) => f.question),
      n,
    ),
    avgPromptLength: n === 0 ? undefined : classified.reduce((a, c) => a + c.flags.length, 0) / n,
    interruptRatio: ratio(interruptPrompts + interruptMarkers, n),
    concreteRatio: ratio(
      count((f) => f.concrete),
      n,
    ),
    abstractRatio: ratio(
      count((f) => f.abstract),
      n,
    ),
    errorPasteRatio: ratio(
      count((f) => f.errorPaste),
      n,
    ),
    emotionRatio: ratio(
      count((f) => f.emotion),
      n,
    ),
    shortImperativeRatio: ratio(
      count((f) => f.shortImperative),
      n,
    ),
    planRatio: ratio(planPrompts + planSignals, n),
    testRatio: ratio(pool.filter((c) => c.test).length, pool.length),
    forceRatio: ratio(pool.filter(isForceful).length, pool.length),
    redirectRatio: ratio(
      count((f) => f.redirect),
      n,
    ),
    lowQualityCommitRatio: ratio(commits.filter((c) => c.lowQualityCommit).length, commits.length),
  };
  // undefined 시그널은 키 자체를 뺀다 (JSON 출력과 deep-equal 비교가 깔끔하도록).
  for (const key of Object.keys(signals) as (keyof Signals)[]) {
    if (signals[key] === undefined) delete signals[key];
  }

  const stats: Stats = {
    promptCount: n,
    shellCount: shell.length,
    sessionCount: liveSessions.length,
    avgTurns: avgTurnsRaw === undefined ? 0 : round1(avgTurnsRaw),
    longestSession,
    ...(hours.peakHour !== undefined ? { peakHour: hours.peakHour } : {}),
    nightRatio: Math.round(hours.nightRatio * 100),
    forceCount: pool.filter((c) => c.forcePush).length,
    rmrfCount: pool.filter((c) => c.rmRf).length,
    sudoBangCount: pool.filter((c) => c.sudoBang).length,
    ...(topCommands[0] ? { topCommand: topCommands[0].command } : {}),
    topCommands,
    ...(shortest !== undefined ? { shortestPrompt: shortest } : {}),
    ...(mostRepeated
      ? { mostRepeatedPrompt: { text: mostRepeated[0], count: mostRepeated[1] } }
      : {}),
    redoCount: count((f) => f.redo),
    thanksCount: count((f) => f.thanks),
    interruptCount: interruptPrompts + interruptMarkers,
    ...(topTool ? { topTool: { name: topTool[0], count: topTool[1] } } : {}),
    skippedLines: 0,
  };

  return { signals, stats, classified };
}
