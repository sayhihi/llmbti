import { decodeResultFromHash, extractEncodedResult } from "@llmbit/core";
import type { MbtiType, ResultPayload } from "@llmbit/core";

export type ResultState =
  | { status: "loading" }
  | { status: "result"; payload: ResultPayload }
  /** hash 가 없거나(none) 있는데 못 읽었다(invalid). 둘 다 유형 소개로 fallback 한다. */
  | { status: "none" | "invalid" };

/** hash 에 `r=` 이 실려 있는지. 디코딩 전에 "읽는 중" 상태를 보여 줄지 정한다. */
export function hasEncodedResult(hash: string): boolean {
  return extractEncodedResult(hash) !== null;
}

/**
 * 라우트 유형 + location.hash -> 결과 상태.
 * 디코딩 실패, 버전 불일치, 경로의 유형과 payload 유형이 다르면 invalid.
 *
 * TODO(decision): 경로 /t/INTJ 에 ENFP payload 가 실려 오면 지금은 invalid 로 보고 INTJ 소개를 보여 준다.
 * payload 쪽 유형으로 그려 주는 게 나을 수도 있다.
 */
export async function resolveResult(routeType: MbtiType, hash: string): Promise<ResultState> {
  if (!hasEncodedResult(hash)) return { status: "none" };
  const payload = await decodeResultFromHash(hash);
  if (!payload) return { status: "invalid" };
  if (payload.type !== routeType) return { status: "invalid" };
  return { status: "result", payload };
}
