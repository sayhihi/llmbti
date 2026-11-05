/**
 * ResultPayload <-> URL hash 코덱 (SPEC 9장).
 *
 * 두 형식을 푼다.
 * - `#z=` compact (wire.ts): 배열 + 사전 deflate + base64url. 새 링크는 전부 이걸로 만든다.
 * - `#r=` legacy: JSON -> deflate-raw -> base64url. 2026-11-05 이전에 공유된 링크. 해독만 유지한다.
 *
 * 디코딩은 어떤 입력에도 throw하지 않고 null을 돌려준다. 호출 측은 null이면 유형 소개 페이지로 fallback한다.
 *
 * TODO(decision): encode/decode를 Node에서도 async로 통일했다 (브라우저 스트림 API가 async라서).
 * CLI render에서 동기 API가 편하면 zlib 전용 encodePayloadSync를 따로 열지 결정 필요.
 */

import { fromBase64Url, toBase64Url } from "./base64url";
import { deflateRaw, inflateRaw } from "./compress";
import { AXES, isMbtiType, PAYLOAD_VERSION } from "./types";
import type { CopyJson, ResultPayload, Scores } from "./types";
import { decodeCompact, encodeCompact } from "./wire";

/** 이 길이를 넘는 결과 URL은 경고한다. 일부 메신저가 링크를 자른다. ⚙️ 튜닝 대상 */
export const URL_WARN_LENGTH = 2000;

/** legacy 결과 키. `#r=...` (JSON deflate). 해독만 한다. */
export const RESULT_HASH_KEY = "r";
/** compact 결과 키. `#z=...`. 새 링크는 이걸 쓴다. */
export const COMPACT_HASH_KEY = "z";

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

export async function encodePayload(payload: ResultPayload): Promise<string> {
  const json = JSON.stringify(payload);
  const compressed = await deflateRaw(encoder.encode(json));
  return toBase64Url(compressed);
}

export async function decodePayload(encoded: string): Promise<ResultPayload | null> {
  try {
    if (typeof encoded !== "string" || encoded.length === 0) return null;
    const bytes = fromBase64Url(encoded.trim());
    if (!bytes || bytes.length === 0) return null;
    const raw = await inflateRaw(bytes);
    const parsed: unknown = JSON.parse(decoder.decode(raw));
    return validatePayload(parsed);
  } catch {
    return null;
  }
}

/** 구조와 버전을 검사한다. 통과하면 같은 객체를 ResultPayload로 돌려준다. */
export function validatePayload(value: unknown): ResultPayload | null {
  if (!isRecord(value)) return null;
  if (value.v !== PAYLOAD_VERSION) return null;
  if (!isMbtiType(value.type)) return null;
  if (!isScores(value.scores)) return null;
  if (!isStringArray(value.badges)) return null;
  if (!isNumberRecord(value.stats)) return null;
  if (!isCopyJson(value.copy)) return null;
  if (value.mode !== "claude" && value.mode !== "lite") return null;
  if (!isFiniteNumber(value.periodDays)) return null;
  if (
    !isRecord(value.sampleSize) ||
    !isFiniteNumber(value.sampleSize.prompts) ||
    !isFiniteNumber(value.sampleSize.shell)
  ) {
    return null;
  }
  return value as ResultPayload;
}

/**
 * 결과 URL을 만든다. `https://llmbti.vercel.app` + payload -> `https://llmbti.vercel.app/t/ENFP#z=...`
 * 길이 경고는 호출 측이 `url.length > URL_WARN_LENGTH`로 판단한다.
 */
export async function buildResultUrl(baseUrl: string, payload: ResultPayload): Promise<string> {
  const base = baseUrl.replace(/\/+$/, "");
  return `${base}/t/${payload.type}#${COMPACT_HASH_KEY}=${encodeCompact(payload)}`;
}

/** legacy `#r=` URL. 테스트와 호환 확인용. 새 링크에는 쓰지 않는다. */
export async function buildLegacyResultUrl(
  baseUrl: string,
  payload: ResultPayload,
): Promise<string> {
  const base = baseUrl.replace(/\/+$/, "");
  const encoded = await encodePayload(payload);
  return `${base}/t/${payload.type}#${RESULT_HASH_KEY}=${encoded}`;
}

export type EncodedResult = {
  key: typeof COMPACT_HASH_KEY | typeof RESULT_HASH_KEY;
  value: string;
};

/** hash 에서 결과 문자열과 형식을 꺼낸다. z 와 r 이 둘 다 있으면 z. 없으면 null. */
export function extractEncoded(hash: string): EncodedResult | null {
  const body = hash.startsWith("#") ? hash.slice(1) : hash;
  let legacy: string | null = null;
  for (const part of body.split("&")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq);
    const value = part.slice(eq + 1);
    if (value.length === 0) continue;
    if (key === COMPACT_HASH_KEY) return { key: COMPACT_HASH_KEY, value };
    if (key === RESULT_HASH_KEY && legacy === null) legacy = value;
  }
  return legacy === null ? null : { key: RESULT_HASH_KEY, value: legacy };
}

/** hash 에 결과(z 또는 r)가 실려 있는지. 디코딩 전에 "읽는 중" 상태를 보여 줄지 정한다. */
export function hasResultInHash(hash: string): boolean {
  return extractEncoded(hash) !== null;
}

/** legacy: `location.hash`(`#r=...` 또는 `r=...`)에서 `r` 값만 꺼낸다. 없으면 null. */
export function extractEncodedResult(hash: string): string | null {
  const body = hash.startsWith("#") ? hash.slice(1) : hash;
  for (const part of body.split("&")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq) === RESULT_HASH_KEY) {
      const value = part.slice(eq + 1);
      return value.length > 0 ? value : null;
    }
  }
  return null;
}

/** `location.hash`를 바로 ResultPayload로. `#z=` 는 compact, `#r=` 은 legacy 로 푼다. 실패하면 null. */
export async function decodeResultFromHash(hash: string): Promise<ResultPayload | null> {
  const found = extractEncoded(hash);
  if (!found) return null;
  if (found.key === COMPACT_HASH_KEY) return decodeCompact(found.value);
  return decodePayload(found.value);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

function isNumberRecord(v: unknown): v is Record<string, number> {
  return isRecord(v) && Object.values(v).every(isFiniteNumber);
}

function isScores(v: unknown): v is Scores {
  return isRecord(v) && AXES.every((axis) => isFiniteNumber(v[axis]));
}

function isCopyJson(v: unknown): v is CopyJson {
  if (!isRecord(v)) return false;
  if (v.lang !== "ko" && v.lang !== "en") return false;
  if (typeof v.nickname !== "string") return false;
  if (typeof v.roast !== "string") return false;
  if (!isStringArray(v.evidence)) return false;
  if (typeof v.commitMessage !== "string") return false;
  if (!isRecord(v.pairWith)) return false;
  if (!isMbtiType(v.pairWith.type)) return false;
  if (typeof v.pairWith.reason !== "string") return false;
  return true;
}
