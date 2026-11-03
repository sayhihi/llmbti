/**
 * 유형별 이름, 소개, 궁합 (SPEC 10장 별명표 + 콘텐츠 에이전트 산출물).
 * 원본은 `packages/core/data/typeMeta.ko.json`. 코드에서는 이 파일을 통해서만 읽는다.
 */

import typeMetaKo from "../data/typeMeta.ko.json";
import { MBTI_TYPES, isMbtiType, type MbtiType } from "./types";

export interface TypeMeta {
  /** 별명, ≤ 20자. 예: "리베이스 장인" */
  nickname: string;
  /** 한 줄 캐치프레이즈 */
  tagline: string;
  /** 2~3문장 소개 */
  description: string;
  /** 8×8 소품 이름 */
  prop: string;
  /** 페어 프로그래밍 궁합 */
  pairWith: { type: MbtiType; reason: string };
  /** 상극 */
  clashWith: { type: MbtiType; reason: string };
}

function assertTypeMeta(type: MbtiType, raw: unknown): TypeMeta {
  if (typeof raw !== "object" || raw === null) throw new Error(`typeMeta: ${type} missing`);
  const o = raw as Record<string, unknown>;
  for (const key of ["nickname", "tagline", "description", "prop"] as const) {
    if (typeof o[key] !== "string" || !o[key]) throw new Error(`typeMeta: ${type}.${key} missing`);
  }
  for (const key of ["pairWith", "clashWith"] as const) {
    const rel = o[key] as { type?: unknown; reason?: unknown } | undefined;
    if (!rel || !isMbtiType(rel.type) || typeof rel.reason !== "string")
      throw new Error(`typeMeta: ${type}.${key} invalid`);
  }
  return o as unknown as TypeMeta;
}

/** 16종 전부. 로드 시 모양을 검증한다. */
export const TYPE_META: Readonly<Record<MbtiType, TypeMeta>> = Object.fromEntries(
  MBTI_TYPES.map((t) => [t, assertTypeMeta(t, (typeMetaKo as Record<string, unknown>)[t])]),
) as Record<MbtiType, TypeMeta>;

export function getTypeMeta(type: MbtiType): TypeMeta {
  return TYPE_META[type];
}
