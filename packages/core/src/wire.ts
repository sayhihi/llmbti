/**
 * compact 코덱 (wire v1). ResultPayload 를 키 없는 배열로 접고, 사전 deflate 로 압축해 base64url 로 싣는다.
 * URL: `${base}/t/${TYPE}#z=${encoded}`. 기존 `#r=` (JSON → deflate, 사전 없음) 은 codec.ts 가 계속 푼다.
 *
 * 왜: `#r=` 링크는 1,000자를 넘어 일부 경로(LLM 이 옮겨 적기, 메신저 URL 필드)에서 500자쯤에서 잘렸다.
 * 키를 번호로, 문구를 사전 압축으로 접으면 같은 결과가 450자 안팎이 된다.
 *
 * 배열 모양 (wire v1):
 * [ 1, typeIdx, [EI, SN, TF, JP], modeFlag, periodDays, [prompts, shell],
 *   [badge...], [badgeStat...],
 *   [nickname, roast, [e1, e2, e3], commitMessage, pairTypeIdx, pairReason],
 *   [[[sigIdx, value], ...] x 4축] ]
 *
 * - typeIdx: MBTI_TYPES 번호. badge: BADGE_KEYS 번호, 모르는 키면 문자열 그대로. sigIdx: SIGNAL_KEYS 번호.
 *   세 목록 모두 끝에만 추가하고 순서를 바꾸지 않는다.
 * - modeFlag: 0 claude, 1 lite
 * - badgeStat: 배지 순서대로 BADGE_STAT_KEYS 의 값. 없으면 null. promptCount, shellCount 는 sampleSize 로 복원한다.
 * - why 가 없던 축은 빈 배열.
 * 사전(DICT_WIRE_V1)과 이 배열 모양은 고정이다. 바꾸려면 wire v2 를 새로 만든다.
 */

import { deflateSync, inflateSync, strFromU8, strToU8 } from "fflate";

import { fromBase64Url, toBase64Url } from "./base64url";
import { dictWireV1Bytes } from "./dict";
import {
  AXES,
  BADGE_KEYS,
  BADGE_STAT_KEYS,
  MBTI_TYPES,
  PAYLOAD_VERSION,
  SIGNAL_KEYS,
  isMbtiType,
} from "./types";
import type { Axis, BadgeKey, CopyJson, ResultPayload, SignalKey } from "./types";

export const WIRE_VERSION = 1 as const;

type WireWhy = [number, number][];
type Wire = [
  version: 1,
  typeIdx: number,
  scores: [number, number, number, number],
  modeFlag: 0 | 1,
  periodDays: number,
  sampleSize: [number, number],
  badges: (number | string)[],
  badgeStats: (number | null)[],
  copy: [string, string, [string, string, string], string, number, string],
  why: [WireWhy, WireWhy, WireWhy, WireWhy],
];

export function toWire(p: ResultPayload): Wire {
  const badges = p.badges.map((b) => {
    const i = (BADGE_KEYS as readonly string[]).indexOf(b);
    return i >= 0 ? i : b;
  });
  const badgeStats = p.badges.map((b) => {
    const key = (BADGE_STAT_KEYS as Record<string, keyof ResultPayload["stats"] | null>)[b];
    const v = key ? p.stats[key] : undefined;
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  });
  const why = AXES.map((axis): WireWhy =>
    (p.why?.[axis] ?? []).map(([k, v]) => [SIGNAL_KEYS.indexOf(k), v]),
  ) as Wire[9];
  const e = p.copy.evidence;
  return [
    WIRE_VERSION,
    MBTI_TYPES.indexOf(p.type),
    [p.scores.EI, p.scores.SN, p.scores.TF, p.scores.JP],
    p.mode === "lite" ? 1 : 0,
    p.periodDays,
    [p.sampleSize.prompts, p.sampleSize.shell],
    badges,
    badgeStats,
    [
      p.copy.nickname,
      p.copy.roast,
      [e[0] ?? "", e[1] ?? "", e[2] ?? ""],
      p.copy.commitMessage,
      MBTI_TYPES.indexOf(p.copy.pairWith.type),
      p.copy.pairWith.reason,
    ],
    why,
  ];
}

/** 배열을 ResultPayload 로. 모양이 어긋나면 null. */
export function fromWire(w: unknown): ResultPayload | null {
  if (!Array.isArray(w) || w.length < 10 || w[0] !== WIRE_VERSION) return null;
  const [, typeIdx, scores, modeFlag, periodDays, sampleSize, badges, badgeStats, copy, why] =
    w as unknown[];

  const type = MBTI_TYPES[num(typeIdx) ?? -1];
  if (!type) return null;
  if (!Array.isArray(scores) || scores.length !== 4 || !scores.every(isFiniteNumber)) return null;
  if (modeFlag !== 0 && modeFlag !== 1) return null;
  if (!isFiniteNumber(periodDays)) return null;
  if (!Array.isArray(sampleSize) || sampleSize.length !== 2 || !sampleSize.every(isFiniteNumber)) {
    return null;
  }
  const sc = scores as [number, number, number, number];
  const ss = sampleSize as [number, number];
  if (!Array.isArray(badges) || !Array.isArray(badgeStats) || badgeStats.length !== badges.length) {
    return null;
  }
  const badgeKeys: string[] = [];
  for (const b of badges) {
    if (typeof b === "string") badgeKeys.push(b);
    else {
      const k = BADGE_KEYS[num(b) ?? -1];
      if (!k) return null;
      badgeKeys.push(k);
    }
  }
  const stats: Record<string, number> = { promptCount: ss[0], shellCount: ss[1] };
  badgeKeys.forEach((b, i) => {
    const key = (BADGE_STAT_KEYS as Record<string, string | null>)[b];
    const v = badgeStats[i];
    if (key && isFiniteNumber(v)) stats[key] = v;
  });

  if (!Array.isArray(copy) || copy.length !== 6) return null;
  const [nickname, roast, evidence, commitMessage, pairIdx, pairReason] = copy as unknown[];
  const pairType = MBTI_TYPES[num(pairIdx) ?? -1];
  if (
    typeof nickname !== "string" ||
    typeof roast !== "string" ||
    !Array.isArray(evidence) ||
    !evidence.every((s) => typeof s === "string") ||
    typeof commitMessage !== "string" ||
    !pairType ||
    typeof pairReason !== "string"
  ) {
    return null;
  }
  const copyJson: CopyJson = {
    lang: "ko",
    nickname,
    roast,
    evidence: evidence as string[],
    commitMessage,
    pairWith: { type: pairType, reason: pairReason },
  };

  if (!Array.isArray(why) || why.length !== 4) return null;
  const whyOut: Partial<Record<Axis, [SignalKey, number][]>> = {};
  for (let a = 0; a < 4; a++) {
    const rows = why[a];
    if (!Array.isArray(rows)) return null;
    const out: [SignalKey, number][] = [];
    for (const row of rows) {
      if (!Array.isArray(row) || row.length !== 2) return null;
      const key = SIGNAL_KEYS[num(row[0]) ?? -1];
      if (!key || !isFiniteNumber(row[1])) return null;
      out.push([key, row[1]]);
    }
    if (out.length > 0) whyOut[AXES[a]!] = out;
  }

  const payload: ResultPayload = {
    v: PAYLOAD_VERSION,
    type,
    scores: { EI: sc[0], SN: sc[1], TF: sc[2], JP: sc[3] },
    badges: badgeKeys,
    stats,
    copy: copyJson,
    mode: modeFlag === 1 ? "lite" : "claude",
    periodDays,
    sampleSize: { prompts: ss[0], shell: ss[1] },
  };
  if (Object.keys(whyOut).length > 0) payload.why = whyOut;
  return payload;
}

/** ResultPayload → `#z=` 뒤에 붙는 문자열. 동기. */
export function encodeCompact(payload: ResultPayload): string {
  const json = JSON.stringify(toWire(payload));
  const bytes = deflateSync(strToU8(json), { level: 9, dictionary: dictWireV1Bytes() });
  return toBase64Url(bytes);
}

/** `#z=` 뒤 문자열 → ResultPayload. 어떤 입력에도 throw 하지 않고 null. 동기. */
export function decodeCompact(encoded: string): ResultPayload | null {
  try {
    if (typeof encoded !== "string" || encoded.length === 0) return null;
    const bytes = fromBase64Url(encoded.trim());
    if (!bytes || bytes.length === 0) return null;
    const raw = inflateSync(bytes, { dictionary: dictWireV1Bytes() });
    const parsed: unknown = JSON.parse(strFromU8(raw));
    const payload = fromWire(parsed);
    return payload && isMbtiType(payload.type) ? payload : null;
  } catch {
    return null;
  }
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function num(v: unknown): number | null {
  return isFiniteNumber(v) && Number.isInteger(v) ? v : null;
}

export type { BadgeKey };
