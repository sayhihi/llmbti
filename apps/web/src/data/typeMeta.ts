/**
 * 유형별 콘텐츠. 콘텐츠 에이전트가 packages/core/data/typeMeta.ko.json 을 채운다.
 *
 * TODO(decision): SPEC 4장은 core/src/typeMeta.ts 를 두기로 돼 있다. core가 export하기 전까지
 * 웹이 data JSON을 직접 읽는다. core가 열면 이 파일은 re-export로 바꾼다.
 */

import { MBTI_TYPES, isMbtiType } from "@llmbti/core";
import type { MbtiType, Temperament } from "@llmbti/core";

import raw from "../../../../packages/core/data/typeMeta.ko.json";

export interface TypeRelation {
  type: MbtiType;
  reason: string;
}

export interface TypeMeta {
  nickname: string;
  tagline: string;
  /** 비개발자용 캐치프레이즈. chat 모드 결과 페이지가 tagline 대신 쓴다 */
  chatTagline: string;
  /** 비개발자용 페어 이유. chat 모드에서 AI 페어를 못 쓸 때 정적 페어와 같이 쓴다 */
  chatPairReason: string;
  /** 비개발자용 상극 이유. chat 모드 상극 카드 */
  chatClashReason: string;
  description: string;
  prop: string;
  pairWith: TypeRelation;
  clashWith: TypeRelation;
}

export const TYPE_META = raw as Record<MbtiType, TypeMeta>;

export function getTypeMeta(type: MbtiType): TypeMeta {
  return TYPE_META[type];
}

/**
 * 결과 페이지의 페어 카드에 쓸 궁합. payload 의 pairWith 를 쓰되,
 * 본인 유형이거나 상극(typeMeta.clashWith)과 같으면 정적 typeMeta.pairWith 로 바꾼다.
 * 상극 카드는 항상 typeMeta.clashWith 로 그리므로, LLM 이 상극을 페어로 고르면 두 카드가 같은 유형이 된다.
 */
export function resolvePairWith(type: MbtiType, pair: TypeRelation): TypeRelation {
  const meta = getTypeMeta(type);
  if (pair.type === type || pair.type === meta.clashWith.type) return meta.pairWith;
  return pair;
}

/**
 * chat 모드 궁합 카드 두 장. 상극은 정적 표(clashWith)에 비개발자 문구를 붙이고,
 * 페어는 AI가 고른 걸 쓰되 본인, 상극과 같거나 이유가 비면 정적 페어에 비개발자 문구를 붙인다.
 */
export function chatRelations(
  type: MbtiType,
  pair: TypeRelation,
): { pair: TypeRelation; clash: TypeRelation } {
  const meta = getTypeMeta(type);
  const usable =
    pair.type !== type && pair.type !== meta.clashWith.type && pair.reason.trim() !== "";
  return {
    pair: usable ? pair : { type: meta.pairWith.type, reason: meta.chatPairReason },
    clash: { type: meta.clashWith.type, reason: meta.chatClashReason },
  };
}

/** 대소문자 섞인 라우트 파라미터를 유형으로. 아니면 null. */
export function parseType(value: string | undefined): MbtiType | null {
  if (!value) return null;
  const upper = value.toUpperCase();
  return isMbtiType(upper) ? upper : null;
}

/** 기질 4그룹. 캐릭터 몸 색과 페이지 포인트 색이 여기 붙는다 (SPEC 10장). */
export function temperamentOf(type: MbtiType): Temperament {
  const n = type[1] === "N";
  if (n) return type[2] === "T" ? "NT" : "NF";
  return type[3] === "J" ? "SJ" : "SP";
}

export const TEMPERAMENT_LABEL: Record<Temperament, string> = {
  NT: "분석가",
  NF: "이상가",
  SJ: "관리자",
  SP: "탐험가",
};

export const ALL_TYPES: readonly MbtiType[] = MBTI_TYPES;
