/**
 * 라이트 모드 템플릿 문구 (SPEC 8장 "라이트 모드 템플릿").
 *
 * 시드는 통계의 안정적인 부분집합을 JSON으로 만든 뒤 FNV-1a로 해시한다. 같은 통계면 같은 문구가 나온다.
 * - roast: 3개 중 슬롯이 전부 evidence.ko.json `min` 이상인 것들 중 시드로 하나. 없으면 슬롯이 가장 적은 것.
 * - evidence: evidence.ko.json `priority` 순서로 min 이상인 통계 상위 3개를 `sentences`로 렌더.
 * - commitMessage: 5개 중 시드로 하나.
 * - pairWith: typeMeta.
 */

import { TYPE_META, type CopyJson, type MbtiType, type Stats } from "@llmbti/core";

import { charLength, hasDigit } from "../copy/validate";
import ENFJ from "./ENFJ.ko.json";
import ENFP from "./ENFP.ko.json";
import ENTJ from "./ENTJ.ko.json";
import ENTP from "./ENTP.ko.json";
import ESFJ from "./ESFJ.ko.json";
import ESFP from "./ESFP.ko.json";
import ESTJ from "./ESTJ.ko.json";
import ESTP from "./ESTP.ko.json";
import INFJ from "./INFJ.ko.json";
import INFP from "./INFP.ko.json";
import INTJ from "./INTJ.ko.json";
import INTP from "./INTP.ko.json";
import ISFJ from "./ISFJ.ko.json";
import ISFP from "./ISFP.ko.json";
import ISTJ from "./ISTJ.ko.json";
import ISTP from "./ISTP.ko.json";
import evidenceKo from "./evidence.ko.json";
import insufficientKo from "./insufficient.ko.json";

export interface TypeTemplate {
  type: string;
  nickname: string;
  roast: string[];
  commitMessage: string[];
}

export interface EvidenceTemplate {
  priority: string[];
  min: Record<string, number>;
  sentences: Record<string, string>;
}

export interface InsufficientTemplate {
  title: string;
  variants: string[];
  hint: string;
}

export const TYPE_TEMPLATES: Readonly<Record<MbtiType, TypeTemplate>> = {
  INTJ,
  INTP,
  ENTJ,
  ENTP,
  INFJ,
  INFP,
  ENFJ,
  ENFP,
  ISTJ,
  ISFJ,
  ESTJ,
  ESFJ,
  ISTP,
  ISFP,
  ESTP,
  ESFP,
};

export const EVIDENCE_TEMPLATE: EvidenceTemplate = evidenceKo;
export const INSUFFICIENT_TEMPLATE: InsufficientTemplate = insufficientKo;

const utf8 = new TextEncoder();

/** 32비트 FNV-1a (UTF-8 바이트 기준). 음수가 안 나오게 >>> 0. */
export function fnv1a(input: string): number {
  let h = 0x811c9dc5;
  for (const byte of utf8.encode(input)) {
    h ^= byte;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** 시드에 들어가는 통계 키. 순서 고정. 문자열 통계는 뺀다 (redact 결과가 환경에 따라 다를 수 있어서). */
export const SEED_KEYS: ReadonlyArray<keyof Stats> = [
  "promptCount",
  "shellCount",
  "sessionCount",
  "avgTurns",
  "longestSession",
  "nightRatio",
  "forceCount",
  "rmrfCount",
  "sudoBangCount",
  "redoCount",
  "thanksCount",
  "interruptCount",
];

export function statsSeedString(stats: Partial<Stats>): string {
  const subset: Record<string, number> = {};
  for (const k of SEED_KEYS) {
    const v = stats[k];
    subset[k] = typeof v === "number" && Number.isFinite(v) ? v : 0;
  }
  return JSON.stringify(subset);
}

export function seedOf(stats: Partial<Stats>, salt: string): number {
  return fnv1a(statsSeedString(stats) + ":" + salt);
}

/** `{slot}` 자리 이름 목록 (중복 제거). */
export function slotsOf(template: string): string[] {
  const out = new Set<string>();
  for (const m of template.matchAll(/\{([A-Za-z0-9_]+)\}/g)) out.add(m[1]!);
  return [...out];
}

type StatValue = number | string | undefined;

function statValue(stats: Partial<Stats>, key: string): StatValue {
  const v = (stats as Record<string, unknown>)[key];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") return v;
  return undefined;
}

/** 슬롯이 채울 만한 값인지. 숫자는 evidence `min` 이상, 문자열은 비어 있지 않으면 된다. */
export function slotSatisfied(stats: Partial<Stats>, key: string, ev = EVIDENCE_TEMPLATE): boolean {
  const v = statValue(stats, key);
  if (v === undefined) return false;
  if (typeof v === "string") return true;
  const min = ev.min[key];
  return min === undefined ? true : v >= min;
}

export function fillSlots(template: string, stats: Partial<Stats>): string {
  return template.replace(/\{([A-Za-z0-9_]+)\}/g, (_m, key: string) => {
    const v = statValue(stats, key);
    if (v === undefined) return "0";
    return String(v);
  });
}

export interface PickOptions {
  evidence?: EvidenceTemplate;
  /** roast 길이 상한 (기본 COPY_LIMITS.roast와 같은 200) */
  roastMax?: number;
}

/**
 * roast 3개 중 하나. 슬롯이 전부 채워지고 길이가 맞는 후보 중 시드로 고른다.
 * 후보가 없으면 슬롯이 가장 적은 것(동률이면 앞의 것).
 */
export function pickRoast(
  tpl: TypeTemplate,
  stats: Partial<Stats>,
  seed: number,
  opts: PickOptions = {},
): string {
  const ev = opts.evidence ?? EVIDENCE_TEMPLATE;
  const roastMax = opts.roastMax ?? 200;
  const filled = tpl.roast.map((r) => fillSlots(r, stats));
  const candidates = tpl.roast
    .map((r, i) => i)
    .filter(
      (i) =>
        slotsOf(tpl.roast[i]!).every((k) => slotSatisfied(stats, k, ev)) &&
        charLength(filled[i]!) <= roastMax,
    );
  if (candidates.length > 0) return filled[candidates[seed % candidates.length]!]!;
  let best = 0;
  for (let i = 1; i < tpl.roast.length; i++) {
    if (slotsOf(tpl.roast[i]!).length < slotsOf(tpl.roast[best]!).length) best = i;
  }
  return filled[best] ?? "";
}

/** 문자열 슬롯 문장에 숫자가 없으면 붙여 줄 꼬리. 검증 규칙(evidence에 숫자 필수)을 맞추기 위해서다. */
function digitTail(stats: Partial<Stats>, key: string): string | null {
  if (key === "shortestPrompt" && typeof stats.shortestPrompt === "string") {
    return `, ${charLength(stats.shortestPrompt)}자`;
  }
  if (key === "topCommand") {
    const top = stats.topCommands?.[0];
    if (top && top.command === stats.topCommand && Number.isFinite(top.count)) {
      return `, ${top.count}번`;
    }
  }
  return null;
}

export function renderEvidenceSentence(
  key: string,
  stats: Partial<Stats>,
  ev = EVIDENCE_TEMPLATE,
): string | null {
  const sentence = ev.sentences[key];
  const v = statValue(stats, key);
  if (sentence === undefined || v === undefined) return null;
  let out = sentence.replace(/\{n\}/g, String(v)).replace(/\{s\}/g, String(v));
  if (!hasDigit(out)) {
    const tail = digitTail(stats, key);
    if (tail === null) return null;
    out += tail;
  }
  return out;
}

/** evidence 3개. priority 순서로 min 이상인 것부터. 모자라면 min을 무시하고 숫자 통계로 채운다. */
export function pickEvidence(
  stats: Partial<Stats>,
  opts: { evidence?: EvidenceTemplate; count?: number; maxLength?: number } = {},
): string[] {
  const ev = opts.evidence ?? EVIDENCE_TEMPLATE;
  const count = opts.count ?? 3;
  const maxLength = opts.maxLength ?? 60;
  const out: string[] = [];
  const used = new Set<string>();
  const tryKey = (key: string, requireMin: boolean): void => {
    if (out.length >= count || used.has(key)) return;
    if (requireMin && !slotSatisfied(stats, key, ev)) return;
    const s = renderEvidenceSentence(key, stats, ev);
    if (s === null || charLength(s) > maxLength) return;
    used.add(key);
    out.push(s);
  };
  for (const key of ev.priority) tryKey(key, true);
  for (const key of ev.priority) tryKey(key, false);
  return out;
}

/** 라이트 모드 CopyJson. 결정적: 같은 type + stats면 같은 결과. */
export function buildTemplateCopy(type: MbtiType, stats: Partial<Stats>): CopyJson {
  const tpl = TYPE_TEMPLATES[type];
  const meta = TYPE_META[type];
  return {
    lang: "ko",
    nickname: tpl.nickname,
    roast: pickRoast(tpl, stats, seedOf(stats, "roast")),
    evidence: pickEvidence(stats),
    commitMessage: tpl.commitMessage[seedOf(stats, "commit") % tpl.commitMessage.length] ?? "",
    pairWith: { type: meta.pairWith.type, reason: meta.pairWith.reason },
  };
}

/** "아직 덜 컴파일됨" 문구. 시드로 variant 하나 + hint. */
export function buildInsufficientMessage(
  sampleSize: { prompts: number; shell: number },
  tpl = INSUFFICIENT_TEMPLATE,
): { title: string; body: string; hint: string } {
  const stats = { promptCount: sampleSize.prompts, shellCount: sampleSize.shell };
  const idx = seedOf(stats, "insufficient") % tpl.variants.length;
  return { title: tpl.title, body: fillSlots(tpl.variants[idx] ?? "", stats), hint: tpl.hint };
}
