import { describe, expect, it } from "vitest";
import { fixtureHome } from "../testUtils";
import { isSlashCommand, parseClaudeHistory, parseClaudeHistoryText } from "./claudeHistory";

describe("parseClaudeHistoryText", () => {
  it("display/timestamp/pastedContents 를 읽는다", () => {
    const text = [
      JSON.stringify({
        display: "안녕",
        pastedContents: {},
        timestamp: 1700000000000,
        project: "/x",
      }),
      JSON.stringify({
        display: "붙여넣기 [Pasted text #1 +3 lines]",
        pastedContents: { 1: { id: 1, type: "text", content: "x" } },
        timestamp: 1700000001000,
      }),
    ].join("\n");
    const { items, skipped } = parseClaudeHistoryText(text);
    expect(skipped).toBe(0);
    expect(items).toEqual([
      { text: "안녕", ts: 1700000000000, source: "history", hasPaste: false },
      {
        text: "붙여넣기 [Pasted text #1 +3 lines]",
        ts: 1700000001000,
        source: "history",
        hasPaste: true,
      },
    ]);
  });

  it("깨진 줄, display 가 문자열이 아닌 줄, timestamp 없는 줄은 건너뛰고 센다", () => {
    const text = [
      "not json",
      JSON.stringify({ display: 1, timestamp: 1 }),
      JSON.stringify({ display: "ts 없음" }),
      JSON.stringify([1, 2]),
      "",
      JSON.stringify({ display: "ok", timestamp: "2026-01-01T00:00:00Z" }),
    ].join("\n");
    const { items, skipped } = parseClaudeHistoryText(text);
    expect(skipped).toBe(4);
    expect(items.map((i) => i.text)).toEqual(["ok"]);
    expect(items[0]!.ts).toBe(Date.parse("2026-01-01T00:00:00Z"));
  });

  it("슬래시 명령과 빈 프롬프트는 프롬프트도 아니고 깨진 줄도 아니다", () => {
    const text = [
      JSON.stringify({ display: "/clear", timestamp: 1 }),
      JSON.stringify({ display: "   ", timestamp: 2 }),
      JSON.stringify({ display: "/llmbti", timestamp: 3 }),
      JSON.stringify({ display: "// 주석은 프롬프트다", timestamp: 4 }),
    ].join("\n");
    const { items, skipped } = parseClaudeHistoryText(text);
    expect(skipped).toBe(0);
    expect(items.map((i) => i.text)).toEqual(["// 주석은 프롬프트다"]);
  });

  it("isSlashCommand", () => {
    expect(isSlashCommand("/help")).toBe(true);
    expect(isSlashCommand("  /compact now")).toBe(true);
    expect(isSlashCommand("/ 나누기")).toBe(false);
    expect(isSlashCommand("/Users/x 읽어")).toBe(true); // 경로로 시작하면 어쩔 수 없이 제외된다. 드물다.
  });
});

describe("parseClaudeHistory (fixtures)", () => {
  it("없는 파일이면 found=false", () => {
    const r = parseClaudeHistory("/nonexistent/history.jsonl");
    expect(r).toEqual({ items: [], found: false, skipped: 0 });
  });

  it("home-p 의 history.jsonl 을 읽고 깨진 줄 2개를 센다", () => {
    const r = parseClaudeHistory(`${fixtureHome("home-p")}/.claude/history.jsonl`);
    expect(r.found).toBe(true);
    expect(r.skipped).toBe(2);
    expect(r.items.length).toBeGreaterThan(50);
  });
});
