import { MBTI_TYPES } from "@llmbti/core";
import { describe, expect, it } from "vitest";

import { TYPE_META, chatRelations, resolvePairWith } from "./typeMeta";

describe("resolvePairWith", () => {
  it("payload 의 pairWith 가 정상이면 그대로 쓴다", () => {
    const pair = { type: "ISFJ" as const, reason: "테스트는 저쪽이 알아서 돌려 줌" };
    expect(resolvePairWith("ENFP", pair)).toBe(pair);
  });

  it("상극과 같은 유형이면 정적 typeMeta.pairWith 로 바꾼다", () => {
    const pair = { type: "ISTJ" as const, reason: "테스트는 저쪽이 알아서 돌려 줌" };
    expect(TYPE_META.ENFP.clashWith.type).toBe("ISTJ");
    expect(resolvePairWith("ENFP", pair)).toEqual(TYPE_META.ENFP.pairWith);
  });

  it("본인 유형이면 정적 typeMeta.pairWith 로 바꾼다", () => {
    const pair = { type: "ENFP" as const, reason: "나랑 하면 됨" };
    expect(resolvePairWith("ENFP", pair)).toEqual(TYPE_META.ENFP.pairWith);
  });

  it("정적 표 16종은 페어와 상극이 겹치지 않는다", () => {
    for (const type of MBTI_TYPES) {
      const { pairWith, clashWith } = TYPE_META[type];
      expect(pairWith.type).not.toBe(clashWith.type);
      expect(pairWith.type).not.toBe(type);
      expect(clashWith.type).not.toBe(type);
    }
  });
});

describe("chatRelations (채팅 결과 궁합 카드)", () => {
  it("AI 페어가 멀쩡하면 그대로, 상극은 정적 유형에 비개발자 문구", () => {
    const pair = { type: "ISFJ" as const, reason: "차분하게 받아 줌" };
    expect(chatRelations("ENFP", pair)).toEqual({
      pair,
      clash: { type: "ISTJ", reason: TYPE_META.ENFP.chatClashReason },
    });
  });

  it("AI 페어가 상극이나 본인이거나 이유가 비면 정적 페어에 비개발자 문구", () => {
    const fallback = { type: TYPE_META.INTJ.pairWith.type, reason: TYPE_META.INTJ.chatPairReason };
    // 2026-11-28 로그아웃 ChatGPT 테스트에서 INTJ 에게 상극인 ESFP 를 페어로 골랐다
    expect(chatRelations("INTJ", { type: "ESFP", reason: "숨통을 틔워 준다" }).pair).toEqual(
      fallback,
    );
    expect(chatRelations("INTJ", { type: "INTJ", reason: "나랑" }).pair).toEqual(fallback);
    expect(chatRelations("INTJ", { type: "ISFJ", reason: " " }).pair).toEqual(fallback);
  });

  it("16종 모두 비개발자 페어, 상극 문구가 40자 이하로 있고 개발 용어가 없다", () => {
    const dev = /PR|브랜치|리베이스|레포|린트|머지|커밋|README|템플릿|호출기|prd|데모/;
    for (const type of MBTI_TYPES) {
      const { chatPairReason, chatClashReason } = TYPE_META[type];
      for (const text of [chatPairReason, chatClashReason]) {
        expect(text.length).toBeGreaterThan(0);
        expect([...text].length).toBeLessThanOrEqual(40);
        expect(text).not.toMatch(dev);
      }
    }
  });
});
