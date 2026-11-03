import { decodeResultFromHash, URL_WARN_LENGTH, type CopyJson } from "@llmbti/core";
import { describe, expect, it } from "vitest";

import { analyze } from "./commands/analyze";
import { mapCopyStrings } from "./copy/validate";
import {
  buildPayload,
  buildUrl,
  DEFAULT_BASE_URL,
  resolveBaseUrl,
  selectPayloadStats,
} from "./payload";
import { redact } from "./redact";
import { FIXTURE_NOW, FIXTURE_TZ, fixtureHome } from "./testUtils";

const copy: CopyJson = {
  lang: "ko",
  nickname: "브랜치 방랑자",
  roast: "다시 38번. 틀린 게 아니라 더 재밌는 길이 보여서 바꾼 거다.",
  evidence: ['"다시" 38번', "--force push 12번", "세션당 평균 14턴"],
  commitMessage: "feat: started 3 things, finished 0",
  pairWith: { type: "INTJ", reason: "계획 없이 뻗은 브랜치를 누가 합쳐 줘야 함" },
};

const analysisP = analyze({
  home: fixtureHome("home-p"),
  now: FIXTURE_NOW,
  tzOffsetMinutes: FIXTURE_TZ,
});

describe("selectPayloadStats", () => {
  it("배지가 가리키는 키 + promptCount/shellCount만 싣는다", () => {
    const stats = selectPayloadStats(analysisP.stats, ["forcePusher", "nightOwl"]);
    expect(Object.keys(stats).sort()).toEqual([
      "forceCount",
      "nightRatio",
      "promptCount",
      "shellCount",
    ]);
    expect(stats.forceCount).toBe(analysisP.stats.forceCount);
  });

  it("배지가 없어도 promptCount/shellCount는 있고, 모르는 배지와 문자열 통계는 무시한다", () => {
    expect(Object.keys(selectPayloadStats(analysisP.stats, [])).sort()).toEqual([
      "promptCount",
      "shellCount",
    ]);
    expect(
      Object.keys(selectPayloadStats(analysisP.stats, ["oneWordWonder", "future"])).sort(),
    ).toEqual(["promptCount", "shellCount"]);
  });
});

describe("buildPayload + buildUrl", () => {
  it("payload v1, 배지 ≤ 6, URL은 /t/TYPE#r= 이고 디코드하면 같은 내용", async () => {
    const payload = buildPayload(analysisP, copy, "lite");
    expect(payload.v).toBe(1);
    expect(payload.type).toBe("ENFP");
    expect(payload.mode).toBe("lite");
    expect(payload.badges.length).toBeLessThanOrEqual(6);
    expect(payload.sampleSize).toEqual(analysisP.sampleSize);
    for (const b of payload.badges) {
      if (b === "forcePusher") expect(payload.stats.forceCount).toBeDefined();
      if (b === "nightOwl") expect(payload.stats.nightRatio).toBeDefined();
    }

    const { url, tooLong } = await buildUrl("https://example.test/", payload);
    expect(url.startsWith("https://example.test/t/ENFP#r=")).toBe(true);
    expect(tooLong).toBe(false);
    expect(url.length).toBeLessThan(URL_WARN_LENGTH);
    const decoded = await decodeResultFromHash(url.slice(url.indexOf("#")));
    expect(decoded).toEqual(payload);
  });

  it("문구는 render 단계에서 redact를 다시 통과한다", () => {
    const dirty: CopyJson = {
      ...copy,
      roast: "토큰 sk-abcdefghijklmnopqrstuvwxyz 를 프롬프트에 3번 붙였다. 대단하다.",
      evidence: ["/Users/tester/work 에서 12번", "mail me@example.com 2번", "3번"],
    };
    const safe = mapCopyStrings(dirty, (s) => redact(s, { home: "/Users/tester" }));
    expect(safe.roast).toContain("[SK_TOKEN]");
    expect(safe.roast).not.toContain("sk-abc");
    expect(safe.evidence[0]).toBe("~/work 에서 12번");
    expect(safe.evidence[1]).toBe("mail [EMAIL] 2번");
  });
});

describe("resolveBaseUrl", () => {
  it("--base > LLMBTI_BASE_URL > 기본값", () => {
    expect(resolveBaseUrl(undefined, {})).toBe(DEFAULT_BASE_URL);
    expect(resolveBaseUrl(undefined, { LLMBTI_BASE_URL: "http://localhost:4173" })).toBe(
      "http://localhost:4173",
    );
    expect(resolveBaseUrl("http://x", { LLMBTI_BASE_URL: "http://y" })).toBe("http://x");
    expect(resolveBaseUrl(true, {})).toBe(DEFAULT_BASE_URL);
  });
});
