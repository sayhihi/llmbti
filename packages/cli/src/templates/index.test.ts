import { MBTI_TYPES, TYPE_META, type Stats } from "@llmbit/core";
import { describe, expect, it } from "vitest";

import { analyze } from "../commands/analyze";
import { countSentences, validateCopy } from "../copy/validate";
import { FIXTURE_NOW, FIXTURE_TZ, fixtureHome } from "../testUtils";
import {
  buildInsufficientMessage,
  buildTemplateCopy,
  EVIDENCE_TEMPLATE,
  fillSlots,
  fnv1a,
  pickEvidence,
  pickRoast,
  slotsOf,
  statsSeedString,
  TYPE_TEMPLATES,
} from "./index";

const statsP = analyze({
  home: fixtureHome("home-p"),
  now: FIXTURE_NOW,
  tzOffsetMinutes: FIXTURE_TZ,
}).stats;
const statsJ = analyze({
  home: fixtureHome("home-j"),
  now: FIXTURE_NOW,
  tzOffsetMinutes: FIXTURE_TZ,
}).stats;

const base: Stats = {
  promptCount: 100,
  shellCount: 300,
  sessionCount: 10,
  avgTurns: 8.5,
  longestSession: 20,
  nightRatio: 0,
  forceCount: 0,
  rmrfCount: 0,
  sudoBangCount: 0,
  topCommands: [],
  redoCount: 0,
  thanksCount: 0,
  interruptCount: 0,
  skippedLines: 0,
};

describe("fnv1a / seed", () => {
  it("알려진 값", () => {
    expect(fnv1a("")).toBe(0x811c9dc5);
    expect(fnv1a("a")).toBe(0xe40c292c);
    expect(fnv1a("foobar")).toBe(0xbf9cf968);
  });
  it("시드 문자열은 키 순서가 고정이고 문자열 통계는 안 들어간다", () => {
    const s = statsSeedString({ ...base, topCommand: "git", shortestPrompt: "고쳐" });
    expect(s).not.toContain("git");
    expect(s.indexOf("promptCount")).toBeLessThan(s.indexOf("shellCount"));
    expect(statsSeedString({ ...base, skippedLines: 99 })).toBe(statsSeedString(base));
  });
});

describe("slots", () => {
  it("slotsOf, fillSlots", () => {
    expect(slotsOf("다시 {redoCount}번, {avgTurns}턴, {redoCount}")).toEqual([
      "redoCount",
      "avgTurns",
    ]);
    expect(
      fillSlots("{forceCount}번 {topCommand} {nope}", {
        ...base,
        forceCount: 3,
        topCommand: "git",
      }),
    ).toBe("3번 git 0");
  });
});

describe("pickRoast", () => {
  const tpl = {
    type: "ENFP",
    nickname: "n",
    roast: ["다시 {redoCount}번.", "새벽 {nightRatio}%.", "프롬프트 {promptCount}개. 끝."],
    commitMessage: ["a"],
  };
  it("슬롯이 min 이상인 후보 중에서만 고른다", () => {
    // redoCount 0 (min 1), nightRatio 0 (min 5) → 세 번째만 후보
    expect(pickRoast(tpl, base, 0)).toBe("프롬프트 100개. 끝.");
    expect(pickRoast(tpl, base, 7)).toBe("프롬프트 100개. 끝.");
  });
  it("후보가 없으면 슬롯이 가장 적은 것", () => {
    const t2 = {
      ...tpl,
      roast: ["{redoCount} {nightRatio}", "{redoCount}", "{redoCount} {nightRatio} {forceCount}"],
    };
    expect(pickRoast(t2, base, 3)).toBe("0");
  });
  it("길이를 넘는 후보는 뺀다", () => {
    const t3 = { ...tpl, roast: ["{shortestPrompt}", "짧다. {promptCount}개."] };
    const s = { ...base, shortestPrompt: "가".repeat(120) };
    expect(pickRoast(t3, s, 0, { roastMax: 50 })).toBe("짧다. 100개.");
  });
});

describe("pickEvidence", () => {
  it("priority 순서, min 미만은 건너뛴다", () => {
    const s = {
      ...base,
      forceCount: 2,
      rmrfCount: 0,
      nightRatio: 4,
      redoCount: 12,
      thanksCount: 1,
    };
    expect(pickEvidence(s)).toEqual(["--force push 2번", '"다시" 12번', '"고마워" 1번']);
  });
  it("문자열 슬롯에는 숫자를 붙여서 검증 규칙을 맞춘다", () => {
    const s = {
      ...base,
      shortestPrompt: "고쳐",
      topCommand: "git",
      topCommands: [{ command: "git", count: 77 }],
    };
    const ev = pickEvidence(s);
    expect(ev).toEqual([
      '가장 짧은 프롬프트 "고쳐", 2자',
      "제일 많이 친 명령 git, 77번",
      "최장 세션 20턴",
    ]);
  });
  it("min 이상이 3개가 안 되면 min을 무시하고 채운다", () => {
    const s = { ...base, avgTurns: 0, longestSession: 0, promptCount: 0, shellCount: 0 };
    const ev = pickEvidence(s);
    expect(ev).toHaveLength(3);
    for (const e of ev) expect(e).toMatch(/\d/);
  });
  it("60자를 넘는 문장은 건너뛴다", () => {
    const s = { ...base, shortestPrompt: "가".repeat(70) };
    for (const e of pickEvidence(s)) expect([...e].length).toBeLessThanOrEqual(60);
  });
  it("priority와 sentences, min 키가 서로 맞는다", () => {
    for (const k of EVIDENCE_TEMPLATE.priority)
      expect(EVIDENCE_TEMPLATE.sentences[k]).toBeDefined();
    for (const k of Object.keys(EVIDENCE_TEMPLATE.min))
      expect(EVIDENCE_TEMPLATE.priority).toContain(k);
  });
});

describe("buildTemplateCopy", () => {
  it("같은 통계면 같은 문구 (결정적)", () => {
    const a = buildTemplateCopy("ENFP", statsP);
    const b = buildTemplateCopy("ENFP", structuredClone(statsP));
    expect(a).toEqual(b);
    expect(a.lang).toBe("ko");
    expect(a.pairWith).toEqual(TYPE_META.ENFP.pairWith);
  });
  it("통계가 다르면 (대개) 다른 roast나 커밋 메시지가 나온다", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 12; i++) {
      const c = buildTemplateCopy("ENFP", { ...statsP, promptCount: statsP.promptCount + i });
      seen.add(c.commitMessage);
    }
    expect(seen.size).toBeGreaterThan(1);
  });
  it("16종 전부, 두 페르소나 통계로 검증을 통과한다", () => {
    for (const type of MBTI_TYPES) {
      for (const stats of [statsP, statsJ]) {
        const copy = buildTemplateCopy(type, stats);
        const r = validateCopy(copy);
        expect(r.ok, `${type}: ${!r.ok ? r.problems.join(" / ") : ""}`).toBe(true);
      }
    }
  });
  it("템플릿 roast 3×16은 채우기 전에도 2~3문장이고 금지 문자가 없다", () => {
    for (const type of MBTI_TYPES) {
      const tpl = TYPE_TEMPLATES[type];
      expect(tpl.type).toBe(type);
      expect(tpl.roast).toHaveLength(3);
      expect(tpl.commitMessage).toHaveLength(5);
      for (const r of tpl.roast) {
        const n = countSentences(r);
        expect(n, `${type}: ${r}`).toBeGreaterThanOrEqual(2);
        expect(n, `${type}: ${r}`).toBeLessThanOrEqual(3);
        expect(r).not.toMatch(/[·—–•]/);
      }
    }
  });
});

describe("buildInsufficientMessage", () => {
  it("variant 하나와 hint. 표본 숫자가 채워진다", () => {
    const m = buildInsufficientMessage({ prompts: 3, shell: 7 });
    expect(m.title).toBe("아직 덜 컴파일됨");
    expect(m.hint.length).toBeGreaterThan(0);
    expect(m.body).not.toContain("{");
    expect(buildInsufficientMessage({ prompts: 3, shell: 7 })).toEqual(m);
  });
});
