import { describe, expect, it } from "vitest";

import { fromBase64Url, toBase64Url } from "./base64url";
import {
  buildResultUrl,
  decodePayload,
  decodeResultFromHash,
  encodePayload,
  extractEncodedResult,
  URL_WARN_LENGTH,
  validatePayload,
} from "./codec";
import { deflateRaw, inflateRaw } from "./compress";
import type { ResultPayload } from "./types";

const samplePayload: ResultPayload = {
  v: 1,
  type: "ENFP",
  scores: { EI: 42, SN: -31, TF: 7, JP: -88 },
  badges: ["nightOwl", "forcePusher"],
  stats: { forceCount: 23, lateNightRatio: 0.4 },
  copy: {
    lang: "ko",
    nickname: "브랜치 메뚜기",
    roast: "브랜치는 23개인데 머지는 0개다. 새벽 3시에 --force를 12번 쳤다.",
    evidence: ["브랜치 23개, 머지 0개", "--force push 12번", "새벽 활동 40%"],
    commitMessage: "fix: fix the fix",
    pairWith: { type: "ISTJ", reason: "누군가는 머지를 해야 한다" },
  },
  mode: "claude",
  periodDays: 30,
  sampleSize: { prompts: 120, shell: 940 },
};

describe("base64url", () => {
  it("round trips arbitrary bytes at every length mod 3", () => {
    for (let len = 0; len < 10; len++) {
      const bytes = new Uint8Array(len).map((_, i) => (i * 73 + 11) & 0xff);
      expect(fromBase64Url(toBase64Url(bytes))).toEqual(bytes);
    }
  });

  it("uses only url-safe characters and no padding", () => {
    const bytes = new Uint8Array([0xfb, 0xff, 0xbf, 0xfe]);
    const s = toBase64Url(bytes);
    expect(s).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(s).not.toContain("=");
  });

  it("rejects invalid characters", () => {
    expect(fromBase64Url("ab$c")).toBeNull();
    expect(fromBase64Url("a")).toBeNull();
  });
});

describe("deflate-raw engines", () => {
  it("zlib and web stream implementations are interoperable", async () => {
    const input = new TextEncoder().encode("llmbit ".repeat(50));
    const viaZlib = await deflateRaw(input, "zlib");
    const viaStream = await deflateRaw(input, "stream");
    expect(await inflateRaw(viaZlib, "stream")).toEqual(input);
    expect(await inflateRaw(viaStream, "zlib")).toEqual(input);
  });
});

describe("codec", () => {
  it("round trips a payload", async () => {
    const encoded = await encodePayload(samplePayload);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    const decoded = await decodePayload(encoded);
    expect(decoded).toEqual(samplePayload);
  });

  it("compresses the payload", async () => {
    const encoded = await encodePayload(samplePayload);
    const rawBase64Length = Math.ceil((JSON.stringify(samplePayload).length * 4) / 3);
    expect(encoded.length).toBeLessThan(rawBase64Length);
  });

  it("returns null for garbage input without throwing", async () => {
    const garbage = ["", "   ", "!!!", "notbase64*", "abc", "AAAA", "Zm9vYmFy", "eyJ2IjoxfQ"];
    for (const g of garbage) {
      await expect(decodePayload(g)).resolves.toBeNull();
    }
  });

  it("returns null for valid compressed data that is not a payload", async () => {
    const notJson = toBase64Url(await deflateRaw(new TextEncoder().encode("hello")));
    expect(await decodePayload(notJson)).toBeNull();
    const jsonArray = toBase64Url(await deflateRaw(new TextEncoder().encode("[1,2,3]")));
    expect(await decodePayload(jsonArray)).toBeNull();
  });

  it("returns null for a wrong version", async () => {
    const wrongVersion = { ...samplePayload, v: 2 } as unknown as ResultPayload;
    const encoded = await encodePayload(wrongVersion);
    expect(await decodePayload(encoded)).toBeNull();
  });

  it("returns null for structurally broken payloads", () => {
    expect(validatePayload({ ...samplePayload, type: "XXXX" })).toBeNull();
    expect(validatePayload({ ...samplePayload, scores: { EI: 1 } })).toBeNull();
    expect(validatePayload({ ...samplePayload, mode: "other" })).toBeNull();
    expect(validatePayload({ ...samplePayload, copy: { lang: "ko" } })).toBeNull();
    expect(validatePayload({ ...samplePayload, stats: { a: "1" } })).toBeNull();
    expect(validatePayload(null)).toBeNull();
    expect(validatePayload("ENFP")).toBeNull();
  });
});

describe("result URL", () => {
  it("builds `${base}/t/${TYPE}#r=${encoded}` and strips trailing slashes", async () => {
    const url = await buildResultUrl("https://llmbit.vercel.app/", samplePayload);
    const encoded = await encodePayload(samplePayload);
    expect(url).toBe(`https://llmbit.vercel.app/t/ENFP#r=${encoded}`);
  });

  it("extracts the encoded result from a hash", async () => {
    const url = await buildResultUrl("https://llmbit.vercel.app", samplePayload);
    const hash = new URL(url).hash;
    expect(extractEncodedResult(hash)).toBe(await encodePayload(samplePayload));
    expect(extractEncodedResult("#")).toBeNull();
    expect(extractEncodedResult("#r=")).toBeNull();
    expect(extractEncodedResult("#x=1")).toBeNull();
    expect(extractEncodedResult("x=1&r=abc")).toBe("abc");
  });

  it("decodes straight from location.hash", async () => {
    const url = await buildResultUrl("https://llmbit.vercel.app", samplePayload);
    expect(await decodeResultFromHash(new URL(url).hash)).toEqual(samplePayload);
    expect(await decodeResultFromHash("#r=garbage")).toBeNull();
  });

  it("keeps a typical payload well under the warning threshold", async () => {
    const url = await buildResultUrl("https://llmbit.vercel.app", samplePayload);
    expect(URL_WARN_LENGTH).toBe(2000);
    expect(url.length).toBeLessThan(URL_WARN_LENGTH);
  });
});
