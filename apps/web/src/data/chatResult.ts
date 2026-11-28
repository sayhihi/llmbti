/**
 * 채팅 AI 답변 → ResultPayload (mode "chat"). /paste 페이지가 쓴다.
 *
 * 채팅 프롬프트(chatPrompt.ts)는 답변 끝에 `"llmbti": 1` 이 든 JSON 코드 블록을 붙이게 한다.
 * 사용자는 그 블록만 복사할 수도, 답변 전체를 복사할 수도 있다(모바일 앱의 "메시지 복사").
 * LLM 출력은 조금씩 틀리므로 거부보다 고쳐서 받는 쪽을 고른다. 채팅 사용자에게 다시 써 달라고 하기 어렵기 때문이다.
 *
 * - 답변 어디에 있든 `llmbti` 키가 든 JSON 객체를 찾는다. 코드 펜스, 둥근 따옴표, 끝에 남은 쉼표를 고쳐 본다.
 * - 길이를 넘으면 자르고, 이모지와 금지 문자(가운뎃점, 줄표)는 지우거나 쉼표로 바꾼다.
 * - 이메일, 전화번호, 링크는 가린다. 결과 링크에 실려 남에게 가기 때문이다.
 * - 유형 글자와 점수 부호가 어긋나면 유형을 믿고 부호를 맞춘다. 사용자가 채팅에서 본 게 그 유형이다.
 */

import {
  AXES,
  COPY_LIMITS,
  HANDOVER_KEYS,
  MBTI_TYPES,
  PAYLOAD_VERSION,
  isMbtiType,
} from "@llmbti/core";
import type {
  Axis,
  ChatConfidence,
  ChatMethod,
  Handover,
  MbtiType,
  ResultPayload,
  Scores,
} from "@llmbti/core";

export type ChatParseResult =
  { ok: true; payload: ResultPayload } | { ok: false; reason: ChatParseError };

export type ChatParseError = "empty" | "noCode" | "badType";

export const CHAT_PARSE_MESSAGES: Record<ChatParseError, string> = {
  empty: "붙여넣은 내용이 없다.",
  noCode:
    '결과 코드를 못 찾았다. 답변 맨 끝의 "llmbti" 가 들어 있는 코드 블록까지 복사됐는지 확인하고, 안 되면 답변 전체를 다시 복사해서 붙여넣으면 된다.',
  badType: "결과 코드에 유형 4글자가 없다. AI에게 결과 코드를 다시 보여 달라고 하면 된다.",
};

type Json = Record<string, unknown>;

export function parseChatResult(text: string): ChatParseResult {
  if (typeof text !== "string" || text.trim() === "") return { ok: false, reason: "empty" };
  const obj = findResultObject(text);
  if (!obj) return { ok: false, reason: "noCode" };
  const payload = toPayload(obj);
  if (!payload) return { ok: false, reason: "badType" };
  return { ok: true, payload };
}

// ---------- JSON 찾기 ----------

/** 텍스트 안에서 `llmbti` 키가 있는 JSON 객체를 찾는다. 뒤에 나온 것을 우선한다(답변 끝에 붙으니까). */
export function findResultObject(text: string): Json | null {
  const normalized = text.replace(/\r\n?/g, "\n");
  const candidates = balancedObjects(normalized);
  for (let i = candidates.length - 1; i >= 0; i--) {
    const parsed = parseLoose(candidates[i]!);
    if (parsed && "llmbti" in parsed) return parsed;
  }
  return null;
}

/** `{` 에서 시작해 괄호가 닫히는 덩어리들. 문자열 안의 괄호는 센다에서 뺀다. 바깥 객체만 돌려준다. */
function balancedObjects(text: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    const start = text.indexOf("{", i);
    if (start === -1) break;
    const end = matchBrace(text, start);
    if (end === -1) {
      i = start + 1;
      continue;
    }
    out.push(text.slice(start, end + 1));
    i = end + 1;
  }
  return out;
}

const OPEN_QUOTES = new Set(['"', "“", "”", "„"]);

function matchBrace(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i]!;
    if (inString) {
      if (c === "\\") i++;
      else if (OPEN_QUOTES.has(c)) inString = false;
      continue;
    }
    if (OPEN_QUOTES.has(c)) inString = true;
    else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** JSON.parse 를 그대로 해 보고, 안 되면 흔한 LLM 실수를 고쳐서 한 번 더. */
function parseLoose(chunk: string): Json | null {
  const attempts = [
    chunk,
    chunk
      .replace(/[“”„]/g, '"')
      .replace(/,\s*([}\]])/g, "$1")
      // 문자열 안의 실제 줄바꿈은 JSON 에서 안 되니 공백으로
      .replace(/"((?:[^"\\]|\\.)*)"/g, (m: string) => m.replace(/\n/g, " ")),
  ];
  for (const a of attempts) {
    try {
      const v: unknown = JSON.parse(a);
      if (typeof v === "object" && v !== null && !Array.isArray(v)) return v as Json;
    } catch {
      // 다음 시도
    }
  }
  return null;
}

// ---------- 정리 ----------

const EMOJI_RE = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu;
const DOT_RE = /\s*[·ㆍ•]\s*/g;
const DASH_RE = /\s*[—–―]\s*/g;
const EMAIL_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const URL_RE = /\bhttps?:\/\/\S+|\bwww\.\S+/gi;
const PHONE_RE = /\b0\d{1,2}[-\s]?\d{3,4}[-\s]?\d{4}\b/g;

/** 결과 링크에 실을 문자열 하나를 정리한다. */
export function cleanText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  const s = value
    .replace(EMAIL_RE, "[이메일]")
    .replace(URL_RE, "[링크]")
    .replace(PHONE_RE, "[전화번호]")
    .replace(EMOJI_RE, "")
    .replace(DOT_RE, ", ")
    .replace(DASH_RE, ", ")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .replace(/,\s*,/g, ",")
    .trim();
  return clip(s, max);
}

function clip(s: string, max: number): string {
  const chars = [...s];
  if (chars.length <= max) return s;
  return chars.slice(0, max).join("").trimEnd();
}

function readType(value: unknown): MbtiType | null {
  if (typeof value !== "string") return null;
  const t = value.replace(/[^A-Za-z]/g, "").toUpperCase();
  return isMbtiType(t) ? t : null;
}

/** scores 는 {EI, SN, TF, JP} 객체나 길이 4 배열. 못 읽은 축은 null. */
function readScores(value: unknown): Partial<Record<Axis, number>> {
  const out: Partial<Record<Axis, number>> = {};
  const pick = (axis: Axis, v: unknown) => {
    const n = typeof v === "string" ? Number(v.replace(/[^\d.+-]/g, "")) : v;
    if (typeof n === "number" && Number.isFinite(n)) out[axis] = n;
  };
  if (Array.isArray(value)) AXES.forEach((a, i) => pick(a, value[i]));
  else if (typeof value === "object" && value !== null) {
    const rec = value as Json;
    for (const a of AXES) pick(a, rec[a] ?? rec[a.toLowerCase()]);
  }
  return out;
}

/** 점수 → 유형 (0 이면 앞 글자). 유형이 없을 때만 쓴다. */
function typeFromScores(scores: Partial<Record<Axis, number>>): MbtiType | null {
  if (!AXES.every((a) => typeof scores[a] === "number")) return null;
  const t = AXES.map((a) => ((scores[a] ?? 0) >= 0 ? a[0] : a[1])).join("");
  return isMbtiType(t) ? t : null;
}

/** 유형 글자에 맞게 부호를 맞추고 -100..100 정수로. 점수가 없는 축은 유형 쪽 20점. */
export function alignScores(type: MbtiType, raw: Partial<Record<Axis, number>>): Scores {
  const out = {} as Scores;
  AXES.forEach((axis, i) => {
    const first = type[i] === axis[0];
    const v = raw[axis];
    let mag = typeof v === "number" ? Math.min(100, Math.round(Math.abs(v))) : 20;
    // 0 은 앞 글자로 판정되므로, 뒤 글자 유형이면 -1 로 둔다
    if (!first && mag === 0) mag = 1;
    out[axis] = first ? mag : -mag;
  });
  return out;
}

function readMethod(value: unknown): ChatMethod {
  if (typeof value === "string" && /설문|survey/i.test(value)) return "survey";
  return "record";
}

function readConfidence(value: unknown): ChatConfidence | undefined {
  if (typeof value !== "string") return undefined;
  if (/높|high/i.test(value)) return "high";
  if (/보통|중간|mid|medium/i.test(value)) return "mid";
  if (/낮|low/i.test(value)) return "low";
  return undefined;
}

function toPayload(obj: Json): ResultPayload | null {
  const rawScores = readScores(obj.scores);
  const type = readType(obj.type) ?? typeFromScores(rawScores);
  if (!type) return null;

  const pairObj = (typeof obj.pair === "object" && obj.pair !== null ? obj.pair : {}) as Json;
  const pairType = readType(pairObj.type) ?? fallbackPair(type);
  const evidence = (Array.isArray(obj.evidence) ? obj.evidence : [])
    .map((e) => cleanText(e, COPY_LIMITS.evidenceEach))
    .filter((e) => e !== "")
    .slice(0, COPY_LIMITS.evidenceCount);

  const method = readMethod(obj.method);
  const confidence = method === "record" ? readConfidence(obj.confidence) : undefined;
  const handover = readHandover(obj.handover);

  const payload: ResultPayload = {
    v: PAYLOAD_VERSION,
    type,
    scores: alignScores(type, rawScores),
    badges: [],
    stats: { promptCount: 0, shellCount: 0 },
    copy: {
      lang: "ko",
      nickname: cleanText(obj.nickname, COPY_LIMITS.nickname),
      roast: cleanText(obj.roast, COPY_LIMITS.roast),
      evidence,
      commitMessage: cleanText(obj.status, COPY_LIMITS.commitMessage),
      pairWith: { type: pairType, reason: cleanText(pairObj.reason, COPY_LIMITS.pairReason) },
    },
    mode: "chat",
    periodDays: 0,
    sampleSize: { prompts: 0, shell: 0 },
    chat: confidence ? { method, confidence } : { method },
  };
  if (handover) payload.copy.handover = handover;
  return payload;
}

/** 네 항목을 정리한다. 항목이 하나도 없으면 undefined. 한국어 키("스타일" 등)로 와도 받는다. */
function readHandover(value: unknown): Handover | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const rec = value as Json;
  const alias: Record<string, string[]> = {
    style: ["스타일"],
    likes: ["좋아하는 것", "좋아함"],
    dislikes: ["질색하는 것", "싫어하는 것", "싫어함"],
    soothe: ["달래는 법"],
  };
  const out = {} as Handover;
  for (const k of HANDOVER_KEYS) {
    const raw = rec[k] ?? alias[k]!.map((a) => rec[a]).find((v) => v !== undefined);
    out[k] = cleanText(raw, COPY_LIMITS.handoverEach);
  }
  return HANDOVER_KEYS.some((k) => out[k] !== "") ? out : undefined;
}

/** 페어 유형이 없으면 4글자를 다 뒤집은 유형. 결과 페이지가 본인이나 상극이면 정적 궁합으로 바꾼다. */
function fallbackPair(type: MbtiType): MbtiType {
  const flip: Record<string, string> = {
    E: "I",
    I: "E",
    S: "N",
    N: "S",
    T: "F",
    F: "T",
    J: "P",
    P: "J",
  };
  const t = [...type].map((c) => flip[c] ?? c).join("");
  return isMbtiType(t) ? t : MBTI_TYPES[0];
}
