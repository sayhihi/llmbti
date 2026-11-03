import { describe, expect, it } from "vitest";
import { fixtureHome } from "../testUtils";
import { parseZshHistory, parseZshText, unmetafy } from "./zsh";

describe("parseZshText", () => {
  it("extended 포맷에서 ts 와 명령을 뽑는다", () => {
    const { items, skipped } = parseZshText(": 1699999999:0;git status\n: 1700000000:12;ls -la\n");
    expect(skipped).toBe(0);
    expect(items).toEqual([
      { command: "git status", ts: 1699999999000 },
      { command: "ls -la", ts: 1700000000000 },
    ]);
  });

  it("단순 포맷은 ts 없이 읽는다", () => {
    const { items } = parseZshText("ls\ncd ..\n");
    expect(items).toEqual([{ command: "ls" }, { command: "cd .." }]);
  });

  it("줄 끝 역슬래시 멀티라인을 명령 하나로 합친다 (extended, 단순 둘 다)", () => {
    const text = [
      ': 1700000000:0;git commit -m "fix: \\',
      '여러 줄"',
      "echo a \\",
      "b \\",
      "c",
      ": 1700000001:0;ls",
    ].join("\n");
    const { items, skipped } = parseZshText(text);
    expect(skipped).toBe(0);
    expect(items).toHaveLength(3);
    expect(items[0]).toEqual({ command: 'git commit -m "fix: \n여러 줄"', ts: 1700000000000 });
    expect(items[1]).toEqual({ command: "echo a \nb \nc" });
    expect(items[2]!.command).toBe("ls");
  });

  it("깨진 extended 헤더와 빈 명령은 건너뛰고 센다", () => {
    const { items, skipped } = parseZshText(": broken:x;\n: 1700000000:0;\n\n   \nls\n");
    expect(skipped).toBe(2);
    expect(items).toEqual([{ command: "ls" }]);
  });

  it("unmetafy 는 0x83 이스케이프를 원래 바이트로 되돌린다", () => {
    const raw = Buffer.from("한글", "utf8");
    const metafied: number[] = [];
    for (const b of raw) {
      if (b >= 0x80) metafied.push(0x83, b ^ 0x20);
      else metafied.push(b);
    }
    expect(unmetafy(Buffer.from(metafied)).toString("utf8")).toBe("한글");
    expect(unmetafy(Buffer.from("plain"))).toEqual(Buffer.from("plain"));
  });
});

describe("parseZshHistory (fixtures)", () => {
  it("home-p 의 .zsh_history: extended + 멀티라인 + 깨진 줄 1개", () => {
    const r = parseZshHistory(`${fixtureHome("home-p")}/.zsh_history`);
    expect(r.found).toBe(true);
    expect(r.skipped).toBe(1);
    expect(r.items.length).toBeGreaterThanOrEqual(215);
    expect(r.items.some((i) => i.command.includes("\n"))).toBe(true);
    expect(r.items.every((i) => !i.command.startsWith(": "))).toBe(true);
  });

  it("없으면 found=false", () => {
    expect(parseZshHistory("/nonexistent/.zsh_history").found).toBe(false);
  });
});
