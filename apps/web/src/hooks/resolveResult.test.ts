import { buildResultUrl, encodePayload } from "@llmbti/core";
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
    if (state.status === "result") expect(state.payload).toEqual(payload);
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
