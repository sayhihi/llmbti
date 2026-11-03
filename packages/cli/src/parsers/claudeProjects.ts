/**
 * `~/.claude/projects/<project>/<session>.jsonl` 파서.
 *
 * 관측된 줄 종류 (type 필드):
 *   user            사람 입력 또는 tool_result. message.role="user", message.content는 문자열이거나 블록 배열
 *   assistant       message.content 블록 배열. tool_use 블록은 { type, id, name, input }
 *   system, attachment, file-history-snapshot, permission-mode, mode, last-prompt, ai-title, api-request* ...
 *
 * 사람 프롬프트로 세는 조건 (SPEC 5장):
 *   type === "user" && !isSidechain && !isMeta && toolUseResult 없음
 *   && content가 문자열이거나 text 블록만 있는 배열 (tool_result 블록이 있으면 제외)
 *   && `<command-name>`, `<local-command-stdout>`, `<system-reminder>` 같은 시스템 태그로 시작하지 않음
 *   && "[Request interrupted by user]" 마커가 아님 (이건 인터럽트로만 센다)
 *
 * 세션 = 파일 1개. sessionId 필드가 있으면 그걸, 없으면 파일 이름을 쓴다.
 */

import { readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import type { ParseResult, PromptEvent, SessionLog } from "./common";
import { isRecord, parseJsonl, readTextSafe, toEpochMs } from "./common";
import { isSlashCommand } from "./claudeHistory";

/** Claude Code가 사용자 턴에 끼워 넣는 시스템 태그. 이걸로 시작하면 사람 프롬프트가 아니다. */
const SYSTEM_TAG =
  /^\s*<(command-name|command-message|command-args|local-command-stdout|local-command-stderr|local-command-caveat|system-reminder|bash-input|bash-stdout|bash-stderr|user-memory-input|ide_opened_file|ide_selection|task-notification|antml:function_results)\b/i;

export const INTERRUPT_MARKER = /\[Request interrupted by user( for tool use)?\]/i;

const PLAN_TOOLS = new Set(["TodoWrite", "EnterPlanMode", "ExitPlanMode"]);

export interface Window {
  since: number;
  until: number;
}

interface ContentBlock {
  type?: unknown;
  text?: unknown;
  name?: unknown;
  input?: unknown;
}

function blocksOf(content: unknown): ContentBlock[] | null {
  if (!Array.isArray(content)) return null;
  return content.filter(isRecord) as ContentBlock[];
}

/** user 줄에서 사람 텍스트를 뽑는다. 사람 프롬프트가 아니면 null. */
function humanTextOf(obj: Record<string, unknown>): string | null {
  if (obj.isSidechain === true) return null;
  if (obj.isMeta === true) return null;
  if (obj.toolUseResult !== undefined) return null;
  const message = obj.message;
  if (!isRecord(message)) return null;
  if (message.role !== undefined && message.role !== "user") return null;
  const content = message.content;
  if (typeof content === "string") return content;
  const blocks = blocksOf(content);
  if (!blocks) return null;
  if (blocks.some((b) => b.type === "tool_result")) return null;
  const texts = blocks
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string);
  if (texts.length === 0) return null;
  return texts.join("\n");
}

export function parseSessionText(
  text: string,
  fallbackId: string,
  window?: Window,
): SessionLog & { skipped: number } {
  const session: SessionLog & { skipped: number } = {
    sessionId: fallbackId,
    prompts: [],
    interruptMarkers: 0,
    toolUses: {},
    bashCommands: [],
    planSignals: 0,
    skipped: 0,
  };
  let idFromLog: string | undefined;

  const { skipped } = parseJsonl<true>(text, (obj) => {
    if (idFromLog === undefined && typeof obj.sessionId === "string") idFromLog = obj.sessionId;
    const ts = toEpochMs(obj.timestamp);
    if (window && ts !== undefined && (ts < window.since || ts > window.until)) return true;
    if (obj.isSidechain === true) return true;

    if (obj.type === "user") {
      const human = humanTextOf(obj);
      if (human === null) return true;
      if (INTERRUPT_MARKER.test(human)) {
        session.interruptMarkers++;
        return true;
      }
      const trimmed = human.trim();
      if (trimmed === "" || SYSTEM_TAG.test(trimmed) || isSlashCommand(trimmed)) return true;
      if (ts === undefined) return true;
      session.prompts.push({ text: trimmed, ts, sessionId: fallbackId, source: "projects" });
      return true;
    }

    if (obj.type === "assistant") {
      const message = obj.message;
      if (!isRecord(message)) return true;
      const blocks = blocksOf(message.content);
      if (!blocks) return true;
      for (const b of blocks) {
        if (b.type !== "tool_use" || typeof b.name !== "string") continue;
        session.toolUses[b.name] = (session.toolUses[b.name] ?? 0) + 1;
        if (PLAN_TOOLS.has(b.name)) session.planSignals++;
        if (b.name === "Bash" && isRecord(b.input) && typeof b.input.command === "string") {
          session.bashCommands.push(b.input.command);
        }
      }
      return true;
    }

    if (obj.type === "permission-mode" && obj.permissionMode === "plan") {
      session.planSignals++;
    }
    return true;
  });

  session.skipped = skipped;
  if (idFromLog) {
    session.sessionId = idFromLog;
    for (const p of session.prompts) p.sessionId = idFromLog;
  }
  if (session.prompts.length > 0) {
    session.firstTs = Math.min(...session.prompts.map((p) => p.ts));
  }
  return session;
}

/** projects 디렉터리 아래 `<project>/<session>.jsonl`을 모두 읽는다. 하위 디렉터리(subagents 등)는 보지 않는다. */
export function listSessionFiles(projectsDir: string): string[] {
  const files: string[] = [];
  let projects: string[];
  try {
    projects = readdirSync(projectsDir);
  } catch {
    return files;
  }
  for (const project of projects.sort()) {
    const dir = join(projectsDir, project);
    try {
      if (!statSync(dir).isDirectory()) continue;
      for (const f of readdirSync(dir).sort()) {
        if (!f.endsWith(".jsonl")) continue;
        const full = join(dir, f);
        if (statSync(full).isFile()) files.push(full);
      }
    } catch {
      continue;
    }
  }
  return files;
}

export function parseClaudeProjects(projectsDir: string, window?: Window): ParseResult<SessionLog> {
  const files = listSessionFiles(projectsDir);
  if (files.length === 0) return { items: [], found: false, skipped: 0 };
  const items: SessionLog[] = [];
  let skipped = 0;
  for (const file of files) {
    const text = readTextSafe(file);
    if (text === null) continue;
    const { skipped: s, ...session } = parseSessionText(text, basename(file, ".jsonl"), window);
    skipped += s;
    // 프롬프트도 툴 사용도 없는 세션(메타 전용)은 버린다.
    if (session.prompts.length === 0 && Object.keys(session.toolUses).length === 0) continue;
    items.push(session);
  }
  return { items, found: true, skipped };
}

/** 모든 세션의 사람 프롬프트를 시간순으로 합친다. */
export function promptsOfSessions(sessions: SessionLog[]): PromptEvent[] {
  return sessions
    .flatMap((s) => s.prompts)
    .sort((a, b) => a.ts - b.ts || a.text.localeCompare(b.text));
}
