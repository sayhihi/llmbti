import { describe, expect, it } from "vitest";
import { fixtureHome } from "../testUtils";
import { parseBashHistory, parseBashText } from "./bash";

describe("parseBashText", () => {
  it("단순 포맷", () => {
    expect(parseBashText("ls\ngit status\n")).toEqual({
      items: [{ command: "ls" }, { command: "git status" }],
      skipped: 0,
    });
  });

  it("HISTTIMEFORMAT 타임스탬프 주석을 다음 명령의 ts 로 쓴다", () => {
    const { items, skipped } = parseBashText("#1700000000\nls\n#1700000001\ngit status\ncd ..\n");
    expect(skipped).toBe(0);
    expect(items).toEqual([
      { command: "ls", ts: 1700000000000 },
      { command: "git status", ts: 1700000001000 },
      { command: "cd .." },
    ]);
  });

  it("멀티라인 이어짐과 빈 줄 처리", () => {
    const { items, skipped } = parseBashText("#1700000000\n\nmake \\\n  test\n\n");
    expect(skipped).toBe(1); // ts 주석 뒤 빈 명령
    expect(items).toEqual([{ command: "make \n  test" }]);
  });
});

describe("parseBashHistory (fixtures)", () => {
  it("home-j 의 .bash_history 를 읽는다", () => {
    const r = parseBashHistory(`${fixtureHome("home-j")}/.bash_history`);
    expect(r.found).toBe(true);
    expect(r.skipped).toBe(0);
    expect(r.items.length).toBe(232);
    expect(r.items.every((i) => typeof i.ts === "number")).toBe(true);
  });

  it("home-p 에는 bash 히스토리가 없다", () => {
    expect(parseBashHistory(`${fixtureHome("home-p")}/.bash_history`).found).toBe(false);
  });
});
