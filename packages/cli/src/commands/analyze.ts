/**
 * `llmbit analyze` (SPEC 12장). 로그 읽기 → 기간 필터 → 시그널 → 점수 → 배지/샘플 → AnalysisOutput.
 *
 * 프롬프트 소스는 둘이다. 세션 로그(projects)가 1차, history.jsonl은 세션 로그에 없는 프롬프트만 보탠다
 * (세션 로그 보관 기간이 짧아서 history.jsonl이 더 길게 남는다). 같은 프롬프트는 ts ±2초로 중복 제거한다.
 */

import { AXES } from "@llmbit/core";
import type { AnalysisOutput, Axis, Stats } from "@llmbit/core";
import { isLowSample, pickBadges } from "../badges";
import { computeMetrics } from "../metrics";
import { parseBashHistory } from "../parsers/bash";
import { parseClaudeHistory } from "../parsers/claudeHistory";
import { parseClaudeProjects, promptsOfSessions } from "../parsers/claudeProjects";
import type { PromptEvent, ShellEvent } from "../parsers/common";
import { inWindow } from "../parsers/common";
import { resolveLogPaths } from "../parsers/paths";
import { parseZshHistory } from "../parsers/zsh";
import { redactAndTrim } from "../redact";
import { pickSamples } from "../samples";
import { displayType, score } from "../scoring";
import { DEFAULT_DAYS, MIN_PROMPTS, MIN_SHELL, SAMPLE_MAX_LENGTH } from "../scoring.constants";

export interface AnalyzeOptions {
  /** 가짜 홈 디렉터리 (테스트, fixtures) */
  home?: string;
  days?: number;
  /** 셸 히스토리 포함 여부. 기본 true (동의는 스킬이 받는다) */
  shell?: boolean;
  /** 기준 시각 epoch ms. 기본 Date.now(). 테스트용 */
  now?: number;
  /** 시간대 오프셋(분). 기본 로컬. 테스트용 */
  tzOffsetMinutes?: number;
}

const DEDUPE_WINDOW_MS = 2000;

/** history.jsonl 프롬프트 중 세션 로그에 이미 있는 것(ts ±2초 또는 같은 텍스트 ±60초)을 뺀다. */
export function mergePrompts(
  fromProjects: PromptEvent[],
  fromHistory: PromptEvent[],
): PromptEvent[] {
  const byTs = [...fromProjects].sort((a, b) => a.ts - b.ts);
  const tsList = byTs.map((p) => p.ts);
  const byText = new Map<string, number[]>();
  for (const p of byTs) {
    const list = byText.get(p.text) ?? [];
    list.push(p.ts);
    byText.set(p.text, list);
  }
  const nearTs = (ts: number): boolean => {
    // 이진 탐색으로 ±DEDUPE_WINDOW_MS 안에 있는지
    let lo = 0;
    let hi = tsList.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const v = tsList[mid]!;
      if (Math.abs(v - ts) <= DEDUPE_WINDOW_MS) return true;
      if (v < ts) lo = mid + 1;
      else hi = mid - 1;
    }
    return false;
  };
  const merged = [...byTs];
  for (const h of fromHistory) {
    if (nearTs(h.ts)) continue;
    const sameText = byText.get(h.text);
    if (sameText && sameText.some((t) => Math.abs(t - h.ts) <= 60_000)) continue;
    merged.push(h);
  }
  return merged.sort((a, b) => a.ts - b.ts || a.text.localeCompare(b.text));
}

export function analyze(opts: AnalyzeOptions = {}): AnalysisOutput {
  const days = opts.days !== undefined && opts.days > 0 ? Math.floor(opts.days) : DEFAULT_DAYS;
  const now = opts.now ?? Date.now();
  const since = now - days * 86_400_000;
  const window = { since, until: now };
  const paths = resolveLogPaths({ home: opts.home });
  const redactOpts = { home: paths.home };
  const useShell = opts.shell !== false;

  const history = parseClaudeHistory(paths.claudeHistory);
  const projects = parseClaudeProjects(paths.claudeProjects, window);
  const zsh = useShell
    ? parseZshHistory(paths.zshHistory)
    : { items: [], found: false, skipped: 0 };
  const bash = useShell
    ? parseBashHistory(paths.bashHistory)
    : { items: [], found: false, skipped: 0 };

  const historyPrompts = history.items.filter((p) => inWindow(p.ts, since, now));
  const prompts = mergePrompts(promptsOfSessions(projects.items), historyPrompts);
  const shell: ShellEvent[] = [...zsh.items, ...bash.items].filter((s) =>
    inWindow(s.ts, since, now),
  );
  const shellEnabled = useShell && (zsh.found || bash.found);

  const metrics = computeMetrics({
    prompts,
    sessions: projects.items,
    shell,
    shellEnabled,
    tzOffsetMinutes: opts.tzOffsetMinutes,
  });
  const skippedLines = history.skipped + projects.skipped + zsh.skipped + bash.skipped;
  const stats = redactStats({ ...metrics.stats, skippedLines }, redactOpts);

  const scoring = score(metrics.signals);
  const sampleSize = { prompts: prompts.length, shell: shell.length };
  const insufficient = sampleSize.prompts < MIN_PROMPTS && sampleSize.shell < MIN_SHELL;
  const badges = pickBadges(stats, isLowSample(sampleSize.prompts));

  return {
    v: 1,
    insufficient,
    periodDays: days,
    sampleSize,
    sources: {
      claudeHistory: history.found,
      claudeProjects: projects.found,
      zsh: zsh.found,
      bash: bash.found,
    },
    scores: scoring.scores,
    type: scoring.type,
    borderline: scoring.borderline,
    badges,
    stats,
    signals: metrics.signals,
    samples: pickSamples(metrics.classified, redactOpts),
  };
}

function redactStats(stats: Stats, redactOpts: { home: string }): Stats {
  const out: Stats = { ...stats };
  if (out.shortestPrompt !== undefined) {
    out.shortestPrompt = redactAndTrim(out.shortestPrompt, SAMPLE_MAX_LENGTH, redactOpts);
  }
  if (out.mostRepeatedPrompt) {
    out.mostRepeatedPrompt = {
      text: redactAndTrim(out.mostRepeatedPrompt.text, SAMPLE_MAX_LENGTH, redactOpts),
      count: out.mostRepeatedPrompt.count,
    };
  }
  if (out.topCommand !== undefined) out.topCommand = redactAndTrim(out.topCommand, 40, redactOpts);
  out.topCommands = out.topCommands.map((c) => ({
    command: redactAndTrim(c.command, 40, redactOpts),
    count: c.count,
  }));
  return out;
}

/** 사람이 읽는 요약 (--json 아닐 때). 샘플 원문은 찍지 않는다. */
export function formatAnalysis(result: AnalysisOutput): string {
  const lines: string[] = [];
  const { stats, sampleSize } = result;
  // SPEC 12장 스타일: `E ████░░ I  +33`. 앞 글자 쪽이 채워진 칸 수다.
  const bar = (axis: Axis): string => {
    const v = result.scores[axis];
    const [front, back] = axis.split("") as [string, string];
    const cells = 10;
    const filled = Math.round(((v + 100) / 200) * cells);
    const gauge = "█".repeat(filled) + "░".repeat(cells - filled);
    const mark = result.borderline.includes(axis) ? " (경계)" : "";
    return `${front} ${gauge} ${back}  ${v > 0 ? "+" : ""}${v}${mark}`;
  };
  lines.push(`llmbit analyze  (최근 ${result.periodDays}일)`);
  lines.push("");
  if (result.insufficient) {
    lines.push(
      `아직 덜 컴파일됨. 프롬프트 ${sampleSize.prompts}개, 셸 명령 ${sampleSize.shell}개로는 유형이 안 나온다. (기준: 프롬프트 ${MIN_PROMPTS}개 또는 셸 ${MIN_SHELL}개)`,
    );
    lines.push("");
  } else {
    lines.push(
      `유형  ${result.type}${result.borderline.length ? `  (${displayType({ scores: result.scores, type: result.type, borderline: result.borderline })})` : ""}`,
    );
    for (const axis of AXES) lines.push("  " + bar(axis));
    lines.push("");
  }
  const row = (k: string, v: string | number | undefined) =>
    v === undefined ? null : `  ${k.padEnd(14)} ${v}`;
  const rows = [
    row("프롬프트", sampleSize.prompts),
    row("셸 명령", sampleSize.shell),
    row("세션", stats.sessionCount),
    row("평균 턴", stats.avgTurns),
    row("최장 세션", stats.longestSession),
    row("피크 시간", stats.peakHour !== undefined ? `${stats.peakHour}시` : undefined),
    row("새벽 비율", `${stats.nightRatio}%`),
    row("--force push", stats.forceCount),
    row("rm -rf", stats.rmrfCount),
    row("sudo !!", stats.sudoBangCount),
    row("다시", stats.redoCount),
    row("고마워", stats.thanksCount),
    row("인터럽트", stats.interruptCount),
    row("top 명령", stats.topCommand),
    row("top 툴", stats.topTool ? `${stats.topTool.name} (${stats.topTool.count})` : undefined),
    row("건너뛴 줄", stats.skippedLines),
  ].filter((r): r is string => r !== null);
  lines.push(...rows);
  lines.push("");
  lines.push(`배지  ${result.badges.length ? result.badges.join(", ") : "-"}`);
  const src = Object.entries(result.sources)
    .filter(([, v]) => v)
    .map(([k]) => k);
  lines.push(`소스  ${src.length ? src.join(", ") : "-"}`);
  lines.push(`샘플  ${result.samples.length}개 (--json 으로 확인)`);
  return lines.join("\n") + "\n";
}
