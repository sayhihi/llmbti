import { describe, expect, it } from "vitest";
import { fixtureHome } from "../testUtils";
import {
  INTERRUPT_MARKER,
  listSessionFiles,
  parseClaudeProjects,
  parseSessionText,
  promptsOfSessions,
} from "./claudeProjects";

const TS = "2026-10-20T10:00:00.000Z";

function user(content: unknown, extra: Record<string, unknown> = {}) {
  return JSON.stringify({
    type: "user",
    isSidechain: false,
    message: { role: "user", content },
    timestamp: TS,
    sessionId: "sess-1",
    ...extra,
  });
}

function assistant(blocks: unknown[]) {
  return JSON.stringify({
    type: "assistant",
    isSidechain: false,
    message: { role: "assistant", content: blocks },
    timestamp: TS,
    sessionId: "sess-1",
  });
}

describe("parseSessionText", () => {
  it("type user 사람 입력만 프롬프트로 세고 tool_result·meta·sidechain·시스템 태그는 뺀다", () => {
    const text = [
      user("진짜 프롬프트"),
      user([{ type: "text", text: "블록 배열 프롬프트" }]),
      user([{ type: "tool_result", tool_use_id: "t1", content: "ok" }], { toolUseResult: {} }),
      user("<command-name>/clear</command-name>"),
      user("<local-command-stdout>out</local-command-stdout>"),
      user("<system-reminder>x</system-reminder>"),
      user("meta 줄", { isMeta: true }),
      user("사이드체인", { isSidechain: true }),
      user("/compact"),
      user("[Request interrupted by user]"),
      user([{ type: "text", text: "[Request interrupted by user for tool use]" }]),
      JSON.stringify({ type: "system", subtype: "x", timestamp: TS }),
      JSON.stringify({ type: "attachment", attachment: {} }),
      JSON.stringify({
        type: "user",
        message: { role: "assistant", content: "역할이 다름" },
        timestamp: TS,
      }),
      JSON.stringify({ type: "user", message: { role: "user", content: "ts 없음" } }),
    ].join("\n");
    const s = parseSessionText(text, "file-id");
    expect(s.prompts.map((p) => p.text)).toEqual(["진짜 프롬프트", "블록 배열 프롬프트"]);
    expect(s.interruptMarkers).toBe(2);
    expect(s.sessionId).toBe("sess-1");
    expect(s.prompts[0]!.sessionId).toBe("sess-1");
    expect(s.skipped).toBe(0);
  });

  it("tool_use 를 세고 Bash 명령과 계획 신호를 모은다", () => {
    const text = [
      assistant([{ type: "tool_use", id: "1", name: "Bash", input: { command: "pnpm test" } }]),
      assistant([
        { type: "text", text: "..." },
        { type: "tool_use", id: "2", name: "TodoWrite", input: { todos: [] } },
      ]),
      assistant([{ type: "tool_use", id: "3", name: "Read", input: { file_path: "/x" } }]),
      assistant([{ type: "tool_use", id: "4", name: "Bash", input: { command: 123 } }]),
      assistant([{ type: "tool_use", id: "5", name: "EnterPlanMode", input: {} }]),
      JSON.stringify({ type: "permission-mode", permissionMode: "plan", sessionId: "sess-1" }),
      JSON.stringify({ type: "permission-mode", permissionMode: "default", sessionId: "sess-1" }),
      // 사이드체인 어시스턴트는 제외
      JSON.stringify({
        type: "assistant",
        isSidechain: true,
        message: {
          content: [{ type: "tool_use", id: "6", name: "Bash", input: { command: "rm -rf /" } }],
        },
        timestamp: TS,
      }),
    ].join("\n");
    const s = parseSessionText(text, "f");
    expect(s.toolUses).toEqual({ Bash: 2, TodoWrite: 1, Read: 1, EnterPlanMode: 1 });
    expect(s.bashCommands).toEqual(["pnpm test"]);
    expect(s.planSignals).toBe(3);
  });

  it("깨진 줄을 세고 나머지는 계속 읽는다", () => {
    const text = ["{", user("a"), "[]", "null", user("b")].join("\n");
    const s = parseSessionText(text, "f");
    expect(s.skipped).toBe(3);
    expect(s.prompts).toHaveLength(2);
  });

  it("window 밖의 줄은 무시한다", () => {
    const since = Date.parse("2026-10-21T00:00:00Z");
    const s = parseSessionText(user("옛날"), "f", { since, until: since + 1 });
    expect(s.prompts).toHaveLength(0);
  });

  it("INTERRUPT_MARKER", () => {
    expect(INTERRUPT_MARKER.test("[Request interrupted by user]")).toBe(true);
    expect(INTERRUPT_MARKER.test("[Request interrupted by user for tool use]")).toBe(true);
    expect(INTERRUPT_MARKER.test("interrupted 가 들어간 보통 문장")).toBe(false);
  });
});

describe("parseClaudeProjects (fixtures)", () => {
  it("home-j 세션 5개, 세션당 깨진 줄 1개", () => {
    const r = parseClaudeProjects(`${fixtureHome("home-j")}/.claude/projects`);
    expect(r.found).toBe(true);
    expect(r.items).toHaveLength(5);
    expect(r.skipped).toBe(5);
    const prompts = promptsOfSessions(r.items);
    expect(prompts).toHaveLength(7 + 8 + 9 + 10 + 11);
    // 시간순
    for (let i = 1; i < prompts.length; i++)
      expect(prompts[i]!.ts).toBeGreaterThanOrEqual(prompts[i - 1]!.ts);
    // 사이드체인·시스템 태그 프롬프트는 없다
    expect(prompts.some((p) => p.text.includes("서브에이전트"))).toBe(false);
    expect(prompts.some((p) => p.text.startsWith("<"))).toBe(false);
  });

  it("없는 디렉터리면 found=false", () => {
    expect(parseClaudeProjects("/nonexistent/projects")).toEqual({
      items: [],
      found: false,
      skipped: 0,
    });
    expect(listSessionFiles("/nonexistent")).toEqual([]);
  });
});
