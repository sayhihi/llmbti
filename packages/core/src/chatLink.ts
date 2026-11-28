/**
 * 채팅 링크 코덱. 채팅 AI가 코드 실행 도구(파이썬)로 만드는 `/c#j=...` 링크를 푼다.
 *
 * 형식: 배열 JSON → deflate-raw(사전 없음) → base64url(패딩 없음).
 * 사전을 쓰는 `#z=` 와 달리 파이썬 표준 라이브러리만으로 만들 수 있어야 해서 사전을 안 쓴다.
 * 배열 모양 (chat link v1):
 *   [1, type, [EI, SN, TF, JP], method, confidence, nickname, roast, [evidence...], status,
 *    pairType, pairReason, [style, likes, dislikes, soothe], audience]
 * audience("개발" 또는 "일반")는 2026-11-28 에 끝에 붙였다. 없으면 일반으로 본다.
 * 값 검증과 정리는 웹 chatResult.ts 가 결과 코드 JSON 과 같은 규칙으로 한다. 여기서는 풀기만 한다.
 */

import { deflateSync, inflateSync, strFromU8, strToU8 } from "fflate";

import { fromBase64Url, toBase64Url } from "./base64url";

export const CHAT_LINK_VERSION = 1 as const;
/** 링크 hash 키. `/c#j=...` */
export const CHAT_LINK_HASH_KEY = "j";

/** `#j=` 뒤 문자열 → JSON 값. 어떤 입력에도 throw 하지 않고 null. */
export function decodeChatLink(encoded: string): unknown {
  try {
    if (typeof encoded !== "string" || encoded.trim() === "") return null;
    const bytes = fromBase64Url(encoded.trim());
    if (!bytes || bytes.length === 0) return null;
    return JSON.parse(strFromU8(inflateSync(bytes)));
  } catch {
    return null;
  }
}

/** 테스트와 예시용. 실제 링크는 채팅 AI의 파이썬 코드가 만든다. */
export function encodeChatLink(value: unknown): string {
  return toBase64Url(deflateSync(strToU8(JSON.stringify(value)), { level: 9 }));
}
