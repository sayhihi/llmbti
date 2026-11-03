/**
 * 파서 공통: 방어적 파일 읽기, JSONL 줄 단위 파싱, 이벤트 타입.
 * 깨진 줄은 건너뛰고 개수만 센다. 어떤 입력에도 throw하지 않는다.
 */

import { readFileSync, existsSync, statSync } from "node:fs";

/** 사람 프롬프트 1개. 원문은 analyze 출력 전에 redact와 120자 컷을 거친다. */
export interface PromptEvent {
  text: string;
  /** epoch ms */
  ts: number;
  /** 세션 로그에서 온 경우 세션 id */
  sessionId?: string;
  source: "history" | "projects";
  /** history.jsonl의 pastedContents가 있었는지 (붙여넣기 신호) */
  hasPaste?: boolean;
}

/** Claude Code 세션 1개 (projects 아래 세션 jsonl 파일 1개). */
export interface SessionLog {
  sessionId: string;
  prompts: PromptEvent[];
  /** "[Request interrupted by user]" 류 중단 이벤트 수 */
  interruptMarkers: number;
  /** tool_use 이름별 횟수 */
  toolUses: Record<string, number>;
  /** Bash tool_use의 command 값 */
  bashCommands: string[];
  /** TodoWrite + EnterPlanMode/ExitPlanMode + permission-mode plan 전환 횟수 */
  planSignals: number;
  /** 세션 안에서 가장 이른 프롬프트 ts (없으면 undefined) */
  firstTs?: number;
}

/** 셸 명령 1개. ts는 extended history일 때만 있다. */
export interface ShellEvent {
  command: string;
  ts?: number;
}

export interface ParseResult<T> {
  items: T[];
  /** 파일이 존재해서 읽었는지 */
  found: boolean;
  /** 깨진 줄 수 */
  skipped: number;
}

export function emptyResult<T>(): ParseResult<T> {
  return { items: [], found: false, skipped: 0 };
}

/** 파일을 읽는다. 없거나 못 읽으면 null. */
export function readTextSafe(path: string): string | null {
  try {
    if (!existsSync(path)) return null;
    if (!statSync(path).isFile()) return null;
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

/** 줄 단위 분리. CRLF도 처리하고 마지막 빈 줄은 버린다. */
export function splitLines(text: string): string[] {
  const lines = text.split(/\r?\n/);
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

/**
 * JSONL을 한 줄씩 파싱한다. JSON이 아니거나 객체가 아닌 줄, map이 null을 돌려준 줄은
 * 건너뛴 것으로 센다. 빈 줄은 세지 않는다.
 */
export function parseJsonl<T>(
  text: string,
  map: (obj: Record<string, unknown>) => T | null,
): { items: T[]; skipped: number } {
  const items: T[] = [];
  let skipped = 0;
  for (const line of splitLines(text)) {
    if (line.trim() === "") continue;
    let obj: unknown;
    try {
      obj = JSON.parse(line);
    } catch {
      skipped++;
      continue;
    }
    if (!isRecord(obj)) {
      skipped++;
      continue;
    }
    try {
      const mapped = map(obj);
      if (mapped === null) skipped++;
      else items.push(mapped);
    } catch {
      skipped++;
    }
  }
  return { items, skipped };
}

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** ISO 문자열, epoch ms, epoch s 를 모두 epoch ms로. 해석 불가면 undefined. */
export function toEpochMs(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) {
    // 1e12 미만이면 초 단위로 본다 (2001년 이전 ms 값은 실제로 없다).
    return v < 1e12 ? Math.round(v * 1000) : Math.round(v);
  }
  if (typeof v === "string" && v.length > 0) {
    if (/^\d+$/.test(v)) return toEpochMs(Number(v));
    const t = Date.parse(v);
    return Number.isNaN(t) ? undefined : t;
  }
  return undefined;
}

/** [since, until] 범위 안인지. ts가 없으면 통과(필터 불가). */
export function inWindow(ts: number | undefined, since: number, until: number): boolean {
  if (ts === undefined) return true;
  return ts >= since && ts <= until;
}
