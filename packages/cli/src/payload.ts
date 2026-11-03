/**
 * AnalysisOutput + CopyJson → ResultPayload → 결과 URL (SPEC 9장).
 *
 * stats에는 배지 표시에 필요한 숫자만 싣는다: 고른 배지가 가리키는 키 + promptCount, shellCount.
 * 배지 → 통계 키 대응은 apps/web/src/data/badgeLabels.ts와 같다.
 */

import { AXES } from "@llmbti/core";
import type { SignalKey, Signals } from "@llmbti/core";
import { normalizeSignal } from "./scoring";
import { SIGNALS } from "./scoring.constants";
import {
  MAX_BADGES,
  PAYLOAD_VERSION,
  URL_WARN_LENGTH,
  buildResultUrl,
  type AnalysisOutput,
  type BadgeKey,
  type CopyJson,
  type ResultMode,
  type ResultPayload,
  type Stats,
} from "@llmbti/core";

export const DEFAULT_BASE_URL = "https://llmbti.vercel.app";

/** 배지가 보여 주는 숫자 통계 키. 문자열 통계(shortestPrompt)는 URL에 싣지 않는다. */
export const BADGE_STAT_KEYS: Readonly<Record<BadgeKey, ReadonlyArray<keyof Stats>>> = {
  nightOwl: ["nightRatio"],
  forcePusher: ["forceCount"],
  rmrfSurvivor: ["rmrfCount"],
  sudoBanger: ["sudoBangCount"],
  thankYouBot: ["thanksCount"],
  redoLoop: ["redoCount"],
  marathonSession: ["longestSession"],
  oneWordWonder: [],
  lowSample: ["promptCount"],
};

const ALWAYS_KEYS: ReadonlyArray<keyof Stats> = ["promptCount", "shellCount"];

export function selectPayloadStats(
  stats: Stats,
  badges: readonly string[],
): Record<string, number> {
  const keys = new Set<keyof Stats>(ALWAYS_KEYS);
  for (const b of badges) {
    const mapped = (BADGE_STAT_KEYS as Record<string, ReadonlyArray<keyof Stats> | undefined>)[b];
    for (const k of mapped ?? []) keys.add(k);
  }
  const out: Record<string, number> = {};
  for (const k of keys) {
    const v = stats[k];
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
  }
  return out;
}

/** 축마다 |weight * sign * norm| 이 큰 시그널 2개. 값은 소수 셋째 자리까지. */
export function selectWhy(signals: Signals): NonNullable<ResultPayload["why"]> {
  const out: NonNullable<ResultPayload["why"]> = {};
  for (const axis of AXES) {
    const rows: { key: SignalKey; value: number; weight: number }[] = [];
    for (const key of Object.keys(SIGNALS) as SignalKey[]) {
      const spec = SIGNALS[key];
      const value = signals[key];
      if (spec.axis !== axis || typeof value !== "number" || !Number.isFinite(value)) continue;
      rows.push({ key, value, weight: Math.abs(spec.weight * normalizeSignal(key, value)) });
    }
    rows.sort((a, b) => b.weight - a.weight);
    const top = rows.slice(0, 2).map((r): [SignalKey, number] => [r.key, Math.round(r.value * 1000) / 1000]);
    if (top.length > 0) out[axis] = top;
  }
  return out;
}

export function buildPayload(
  analysis: AnalysisOutput,
  copy: CopyJson,
  mode: ResultMode,
): ResultPayload {
  const badges = analysis.badges.slice(0, MAX_BADGES);
  return {
    v: PAYLOAD_VERSION,
    type: analysis.type,
    scores: analysis.scores,
    badges,
    stats: selectPayloadStats(analysis.stats, badges),
    copy,
    mode,
    periodDays: analysis.periodDays,
    sampleSize: analysis.sampleSize,
    why: selectWhy(analysis.signals),
  };
}

/** `--base` > `LLMBTI_BASE_URL` > 기본값. */
export function resolveBaseUrl(
  flag: string | boolean | undefined,
  env: Record<string, string | undefined> = process.env,
): string {
  if (typeof flag === "string" && flag.trim() !== "") return flag.trim();
  const fromEnv = env.LLMBTI_BASE_URL;
  if (typeof fromEnv === "string" && fromEnv.trim() !== "") return fromEnv.trim();
  return DEFAULT_BASE_URL;
}

export interface BuiltUrl {
  url: string;
  /** URL_WARN_LENGTH를 넘으면 true */
  tooLong: boolean;
}

export async function buildUrl(base: string, payload: ResultPayload): Promise<BuiltUrl> {
  const url = await buildResultUrl(base, payload);
  return { url, tooLong: url.length > URL_WARN_LENGTH };
}
