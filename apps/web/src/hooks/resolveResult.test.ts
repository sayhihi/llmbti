import { buildLegacyResultUrl, buildResultUrl, encodeCompact, encodePayload } from "@llmbti/core";
import type { ResultPayload } from "@llmbti/core";
import { describe, expect, it } from "vitest";

import { hasEncodedResult, resolveResult } from "./resolveResult";

const payload: ResultPayload = {
  v: 1,
  type: "ISTP",
  scores: { EI: -40, SN: 35, TF: 66, JP: -3 },
  badges: ["shortPrompter"],
  stats: {},
  copy: {
    lang: "ko",
    nickname: "고쳐 장인",
    roast: "프롬프트 평균 두 글자. 설명은 없고 에러 로그만 있다.",
    evidence: ["프롬프트 평균 2.1자", "고쳐 41번", "세션 평균 3턴"],
    commitMessage: "fix",
    pairWith: { type: "ENFJ", reason: "왜 고쳤는지 대신 설명해 줌" },
  },
  mode: "claude",
  periodDays: 30,
  sampleSize: { prompts: 80, shell: 500 },
};

/** compact 코덱은 stats 를 sampleSize 와 배지 통계로 복원한다. 이 payload 는 배지 통계가 없으니 두 키만 생긴다. */
const compactPayload = { ...payload, stats: { promptCount: 80, shellCount: 500 } };

describe("resolveResult", () => {
  it("returns none when the hash has no r=", async () => {
    expect(hasEncodedResult("")).toBe(false);
    expect(await resolveResult("ISTP", "")).toEqual({ status: "none" });
    expect(await resolveResult("ISTP", "#foo=bar")).toEqual({ status: "none" });
  });

  it("decodes a URL built by core", async () => {
    const url = await buildResultUrl("http://localhost:4173", payload);
    const hash = new URL(url).hash;
    expect(hasEncodedResult(hash)).toBe(true);
    const state = await resolveResult("ISTP", hash);
    expect(state.status).toBe("result");
    if (state.status === "result") expect(state.payload).toEqual(compactPayload);
  });

  it("falls back on a broken hash", async () => {
    expect(await resolveResult("ISTP", "#r=not-base64-deflate")).toEqual({ status: "invalid" });
    expect(await resolveResult("ISTP", "#r=")).toEqual({ status: "none" });
  });

  it("falls back on a wrong version", async () => {
    const encoded = await encodePayload({ ...payload, v: 2 as unknown as 1 });
    expect(await resolveResult("ISTP", `#r=${encoded}`)).toEqual({ status: "invalid" });
  });

  it("falls back when the route type and payload type disagree", async () => {
    const encoded = await encodePayload(payload);
    expect(await resolveResult("ENFP", `#r=${encoded}`)).toEqual({ status: "invalid" });
  });
});

describe("compact (#z=) 와 legacy (#r=) 둘 다", () => {
  it("hasEncodedResult 는 두 키를 모두 본다", () => {
    expect(hasEncodedResult("#z=abc")).toBe(true);
    expect(hasEncodedResult("#r=abc")).toBe(true);
    expect(hasEncodedResult("#x=abc")).toBe(false);
  });

  it("compact 링크를 결과로 푼다", async () => {
    const url = await buildResultUrl("https://llmbti.vercel.app", payload);
    expect(url).toContain("/t/ISTP#z=");
    const state = await resolveResult("ISTP", new URL(url).hash);
    expect(state.status).toBe("result");
    if (state.status === "result") expect(state.payload).toEqual(compactPayload);
  });

  it("legacy 링크도 계속 푼다", async () => {
    const url = await buildLegacyResultUrl("https://llmbti.vercel.app", payload);
    expect(url).toContain("/t/ISTP#r=");
    const state = await resolveResult("ISTP", new URL(url).hash);
    expect(state.status).toBe("result");
  });

  it("잘린 compact 링크는 invalid", async () => {
    const encoded = encodeCompact(payload);
    const state = await resolveResult(
      "ISTP",
      "#z=" + encoded.slice(0, Math.floor(encoded.length / 2)),
    );
    expect(state.status).toBe("invalid");
  });
});
