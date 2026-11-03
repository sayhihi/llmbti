/**
 * `~/.claude/history.jsonl` 파서.
 *
 * 관측된 포맷 (한 줄 = 프롬프트 1개):
 *   { "display": "프롬프트 원문", "pastedContents": { "<id>": { id, type, content } }, "timestamp": 1759044940380, "project": "/path" }
 *
 * - display가 비어 있거나 문자열이 아니면 건너뛴다.
 * - `/clear`, `/help` 같은 슬래시 명령은 사람 프롬프트가 아니므로 제외한다 (건너뛴 줄로 세지 않는다).
 * - timestamp는 ms. 없거나 깨지면 건너뛴다 (기간 필터를 못 하므로).
 */

import type { ParseResult, PromptEvent } from "./common";
import { emptyResult, isRecord, parseJsonl, readTextSafe, toEpochMs } from "./common";

const SLASH_COMMAND = /^\/[a-zA-Z]/;

export function isSlashCommand(text: string): boolean {
  return SLASH_COMMAND.test(text.trim());
}

export function parseClaudeHistoryText(text: string): { items: PromptEvent[]; skipped: number } {
  const parsed = parseJsonl<PromptEvent | "skip">(text, (obj) => {
    const display = obj.display;
    if (typeof display !== "string") return null;
    const ts = toEpochMs(obj.timestamp);
    if (ts === undefined) return null;
    const trimmed = display.trim();
    if (trimmed === "" || isSlashCommand(trimmed)) return "skip";
    const pc = obj.pastedContents;
    const hasPaste = isRecord(pc) && Object.keys(pc).length > 0;
    return { text: trimmed, ts, source: "history", hasPaste };
  });
  return {
    items: parsed.items.filter((p): p is PromptEvent => p !== "skip"),
    skipped: parsed.skipped,
  };
}

export function parseClaudeHistory(path: string): ParseResult<PromptEvent> {
  const text = readTextSafe(path);
  if (text === null) return emptyResult();
  const { items, skipped } = parseClaudeHistoryText(text);
  return { items, found: true, skipped };
}
