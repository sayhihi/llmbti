import { MBTI_TYPES } from "@llmbti/core";
import { describe, expect, it } from "vitest";

import { TYPE_META, resolvePairWith } from "./typeMeta";

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
