import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  buildLegacyResultUrl,
  buildResultUrl,
  decodeResultFromHash,
  extractEncoded,
  hasResultInHash,
} from "./codec";
import { DICT_WIRE_V1, DICT_WIRE_V1_SHA256 } from "./dict";
import type { ResultPayload } from "./types";
import { decodeCompact, encodeCompact, fromWire, toWire } from "./wire";

const sample: ResultPayload = {
  v: 1,
  type: "ENFP",
  scores: { EI: 7, SN: -29, TF: -21, JP: -2 },
  badges: ["forcePusher", "rmrfSurvivor", "oneWordWonder", "futureBadge"],
  stats: { promptCount: 1610, shellCount: 143670, forceCount: 5, rmrfCount: 155 },
  copy: {
    lang: "ko",
    nickname: "다시 112번 고마워 41번",
    roast: "다시 112번, 고마워 41번. 세션당 27턴인데 처음 하려던 건 3턴 만에 사라진다.",
    evidence: ["다시 112번", "rm -rf 155번", "최장 세션 246턴"],
    commitMessage: "wip: 일단 올림",
    pairWith: { type: "ISTJ", reason: "테스트는 저쪽이 알아서 돌려 줌" },
  },
  mode: "claude",
  periodDays: 30,
  sampleSize: { prompts: 1610, shell: 143670 },
  why: {
    EI: [
      ["avgTurns", 27.38],
      ["interruptRatio", 0.016],
    ],
    JP: [["testRatio", 0.001]],
  },
};

/**
 * 2026-11-05 에 실제로 공유된 legacy `#r=` 링크 (ENFP, claude 모드). 1,064자.
 * compact 코덱이 바뀌어도 이 링크는 계속 열려야 한다.
 */
const LEGACY_ENFP =
  "#r=XVTfTxpBEP5XNpv4dhoOQSuPtZpoWmOLiWkID9tjhYvc7WVvQWlj4g9sqGDrgza0QoMJhtb4QKxNIbH_ELv8D529A7V9uczO7Hzzzew39w4XccI0sCh5FCfwwsriKjawbzFOfZx4hxeWcGLWwMkVnJiMzhl4bVEbkLC8qo0dA78hmay-m8IbjFt0teDnKAcM7vCNZIEX7SILjjTDnjPmgSlyxN18zQpPmYCTQzgROeYmqe_bzAUPc-k645l15mYAKQ10BBEBG48zxxPzrOAKYD1jRiCWo_n82BObnpkFX0Bk5IuHTMY34vGQyvhsRkd8_JEnBr3lmQstiTGjRDQ2A41azCtpEnniZmFUmwyoura16RJHj05W26raQIAobypo8LMlOxV1XkMxE856AIz4gI-Hp2V5cQ3f4VEPqVZFduto0N0d9GuqeQsGUp2KvO7BARCnkGreqWYZAfRwvy2PTtHgpobUWVlWK7J5h9TBnqze6huyew7hMCdwIrnXlPt1-QOskNvwDDCvIU3jyM7JiKwRsv0Ct8aBgLSBZL-sGt-BCpLX9eFZXaNDK7RoZ6hrUf3o3EGTfAPBYIOMYPTIAxFoqNCnOrvqa1ef1fuTAOwYqvRb8lK3CHiq1YA2ofBHHVV9YPpoSHomvs-QvGgMfsNcekheHcpW30DR0WjVr4b6dolUuacO6whea1iGkfTkcRem0lYH9VEjKDJhoOFhTR21g-F_7g16H1BkypzQKrOY49jiBTw6yeoH3bC3E0hrBW1rmaBQJmg7ZkJJj9h83RY5LYjR7iwl15YDoRNfiwbfFwo6b-2qqz9Be2c1eD5VbiD5qSZbbaTaNbwD-nJYRsNYeVIAA0pQbrPMM1IC6U9rpRPHy9Ok_ZY-rIL_zxqMNwDAtnKl8fqmUpgUs2sF7vrYiM5OTT9JGylsu4JyXvDEKyJskHJkKmLOpNPhqkOKxVyLU0Hvw2YkpvMgifFVkDL9P1H_GiDRzzEulhxgD_Hio1thXeowcLgP7nhMJ-vfCSQLWLuHUMTUGXm29bJA8rYozQcv9KjuXDq9s_MX";

describe("사전 고정", () => {
  it("DICT_WIRE_V1 은 sha256 이 바뀌면 안 된다 (바뀌면 공유된 #z= 링크가 전부 깨진다)", () => {
    const sha = createHash("sha256").update(DICT_WIRE_V1, "utf8").digest("hex");
    expect(sha).toBe(DICT_WIRE_V1_SHA256);
    expect(sha).toBe("b106c1d9c251" + sha.slice(12));
  });
});

describe("wire 배열", () => {
  it("배지는 번호로, 모르는 배지는 문자열 그대로, 배지 통계는 배지 순서대로", () => {
    const w = toWire(sample);
    expect(w[0]).toBe(1);
    expect(w[1]).toBe(7); // ENFP 는 MBTI_TYPES 8번째
    expect(w[6]).toEqual([1, 2, 7, "futureBadge"]);
    expect(w[7]).toEqual([5, 155, null, null]);
    expect(w[9]).toEqual([
      [
        [0, 27.38],
        [3, 0.016],
      ],
      [],
      [],
      [[10, 0.001]],
    ]);
  });

  it("왕복하면 같은 payload. stats 는 sampleSize 와 배지 통계로 복원된다", () => {
    const back = fromWire(toWire(sample));
    expect(back).toEqual(sample);
  });

  it("stats 에 배지와 무관한 키가 있었으면 그건 버린다", () => {
    const p: ResultPayload = { ...sample, stats: { ...sample.stats, lateNightRatio: 0.4 } };
    expect(fromWire(toWire(p))).toEqual(sample);
  });

  it("why 가 없으면 why 키 자체가 없다", () => {
    const { why: _why, ...noWhy } = sample;
    expect(fromWire(toWire(noWhy))).toEqual(noWhy);
  });

  it("모양이 어긋나면 null", () => {
    expect(fromWire(null)).toBeNull();
    expect(fromWire([2])).toBeNull();
    const w = toWire(sample);
    expect(fromWire([...w.slice(0, 1), 99, ...w.slice(2)])).toBeNull(); // 없는 유형 번호
    expect(fromWire([...w.slice(0, 3), 2, ...w.slice(4)])).toBeNull(); // 모드 플래그
    expect(fromWire([...w.slice(0, 6), [0], [], ...w.slice(8)])).toBeNull(); // 배지와 통계 길이 불일치
    const badCopy = [...w];
    badCopy[8] = ["a", "b", ["c"], "d", 99, "e"];
    expect(fromWire(badCopy)).toBeNull(); // 없는 페어 유형
  });
});

describe("compact 코덱", () => {
  it("왕복", () => {
    expect(decodeCompact(encodeCompact(sample))).toEqual(sample);
  });

  it("쓰레기 입력은 null", () => {
    expect(decodeCompact("")).toBeNull();
    expect(decodeCompact("!!!")).toBeNull();
    expect(decodeCompact("AAAA")).toBeNull();
    expect(decodeCompact(encodeCompact(sample).slice(0, 100))).toBeNull(); // 잘린 링크
  });

  it("실제 legacy 링크를 compact 로 다시 만들면 500자 아래로 내려간다", async () => {
    const legacy = await decodeResultFromHash(LEGACY_ENFP);
    expect(legacy).not.toBeNull();
    expect(legacy!.type).toBe("ENFP");
    const compact = encodeCompact(legacy!);
    expect(LEGACY_ENFP.length - 3).toBe(1064);
    expect(compact.length).toBeLessThan(500);
    expect(decodeCompact(compact)).toEqual(legacy);
  });
});

describe("hash 형식", () => {
  it("새 URL 은 #z=, legacy URL 은 #r=", async () => {
    const url = await buildResultUrl("https://llmbti.vercel.app/", sample);
    expect(url).toMatch(/^https:\/\/llmbti\.vercel\.app\/t\/ENFP#z=[A-Za-z0-9_-]+$/);
    const legacy = await buildLegacyResultUrl("https://llmbti.vercel.app", sample);
    expect(legacy).toMatch(/^https:\/\/llmbti\.vercel\.app\/t\/ENFP#r=[A-Za-z0-9_-]+$/);
    expect(url.length).toBeLessThan(legacy.length);
  });

  it("extractEncoded 는 z 를 우선하고, hasResultInHash 는 둘 다 본다", () => {
    expect(extractEncoded("#z=abc")).toEqual({ key: "z", value: "abc" });
    expect(extractEncoded("#r=abc")).toEqual({ key: "r", value: "abc" });
    expect(extractEncoded("r=old&z=new")).toEqual({ key: "z", value: "new" });
    expect(extractEncoded("#z=&r=abc")).toEqual({ key: "r", value: "abc" });
    expect(extractEncoded("#x=1")).toBeNull();
    expect(extractEncoded("#")).toBeNull();
    expect(hasResultInHash("#z=abc")).toBe(true);
    expect(hasResultInHash("#r=abc")).toBe(true);
    expect(hasResultInHash("")).toBe(false);
  });

  it("decodeResultFromHash 는 두 형식을 모두 푼다", async () => {
    const compactUrl = await buildResultUrl("https://llmbti.vercel.app", sample);
    expect(await decodeResultFromHash(new URL(compactUrl).hash)).toEqual(sample);
    const legacyUrl = await buildLegacyResultUrl("https://llmbti.vercel.app", sample);
    expect(await decodeResultFromHash(new URL(legacyUrl).hash)).toEqual(sample);
    expect(await decodeResultFromHash("#z=garbage")).toBeNull();
  });
});
