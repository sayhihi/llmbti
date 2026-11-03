import { describe, expect, it } from "vitest";
import { resolveHome, resolveLogPaths } from "./paths";

describe("resolveHome / resolveLogPaths", () => {
  it("--home 이 최우선", () => {
    const p = resolveLogPaths({ home: "/fake/home", env: { HOME: "/other", HISTFILE: "/x/h" } });
    expect(p.home).toBe("/fake/home");
    expect(p.claudeHistory).toBe("/fake/home/.claude/history.jsonl");
    expect(p.claudeProjects).toBe("/fake/home/.claude/projects");
    // --home 이면 HISTFILE 은 무시
    expect(p.zshHistory).toBe("/fake/home/.zsh_history");
    expect(p.bashHistory).toBe("/fake/home/.bash_history");
  });

  it("Windows 는 USERPROFILE 을 홈으로 쓴다", () => {
    const home = resolveHome({ env: { USERPROFILE: "C:\\Users\\tester" }, platform: "win32" });
    expect(home).toBe("C:\\Users\\tester");
    const p = resolveLogPaths({ home: "C:\\Users\\tester" });
    expect(p.claudeHistory.endsWith("history.jsonl")).toBe(true);
    expect(p.claudeHistory.startsWith("C:\\Users\\tester")).toBe(true);
  });

  it("HOME 과 HISTFILE 환경변수를 따른다", () => {
    const p = resolveLogPaths({ env: { HOME: "/u/x", HISTFILE: "/u/x/.hist" }, platform: "linux" });
    expect(p.home).toBe("/u/x");
    expect(p.zshHistory).toBe("/u/x/.hist");
    expect(p.claudeProjects).toBe("/u/x/.claude/projects");
  });

  it("CLAUDE_CONFIG_DIR 를 따른다", () => {
    const p = resolveLogPaths({
      env: { HOME: "/u/x", CLAUDE_CONFIG_DIR: "/cfg" },
      platform: "linux",
    });
    expect(p.claudeHistory).toBe("/cfg/history.jsonl");
  });
});
