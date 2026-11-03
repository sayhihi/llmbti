/**
 * zsh 히스토리 파서 (`$HISTFILE` 또는 `~/.zsh_history`).
 *
 * - extended 포맷: `: 1699999999:0;command` (EXTENDED_HISTORY). 앞의 epoch 초를 ts로 쓴다.
 * - 단순 포맷: 한 줄에 명령 하나. ts 없음.
 * - 멀티라인: 줄 끝이 `\`이면 다음 줄로 이어진다. 이어진 줄은 줄바꿈으로 합쳐 명령 하나로 센다.
 * - zsh는 비ASCII 바이트를 0x83 메타 문자로 이스케이프해서 저장한다(metafy). 바이트 단위로 풀고 utf8로 디코드한다.
 * - 빈 명령과 파싱 불가한 extended 헤더는 건너뛴 줄로 센다.
 */

import { readFileSync, existsSync, statSync } from "node:fs";
import type { ParseResult, ShellEvent } from "./common";
import { emptyResult, splitLines } from "./common";

const EXTENDED = /^: (\d+):(\d+);(.*)$/s;

/** zsh metafy 해제. 0x83 다음 바이트는 0x20과 xor 한 원래 바이트다. */
export function unmetafy(buf: Buffer): Buffer {
  if (!buf.includes(0x83)) return buf;
  const out: number[] = [];
  for (let i = 0; i < buf.length; i++) {
    const b = buf[i]!;
    if (b === 0x83 && i + 1 < buf.length) {
      out.push(buf[i + 1]! ^ 0x20);
      i++;
    } else {
      out.push(b);
    }
  }
  return Buffer.from(out);
}

export function parseZshText(text: string): { items: ShellEvent[]; skipped: number } {
  const items: ShellEvent[] = [];
  let skipped = 0;
  const lines = splitLines(text);
  let i = 0;
  while (i < lines.length) {
    let line = lines[i]!;
    i++;
    // 멀티라인: `\`로 끝나면 다음 줄을 이어 붙인다.
    while (line.endsWith("\\") && i < lines.length) {
      line = line.slice(0, -1) + "\n" + lines[i]!;
      i++;
    }
    if (line.trim() === "") continue;
    let command = line;
    let ts: number | undefined;
    if (line.startsWith(": ")) {
      const m = EXTENDED.exec(line);
      if (!m) {
        skipped++;
        continue;
      }
      ts = Number(m[1]) * 1000;
      command = m[3]!;
    }
    command = command.trim();
    if (command === "") {
      skipped++;
      continue;
    }
    items.push(ts === undefined ? { command } : { command, ts });
  }
  return { items, skipped };
}

export function parseZshHistory(path: string): ParseResult<ShellEvent> {
  let buf: Buffer;
  try {
    if (!existsSync(path) || !statSync(path).isFile()) return emptyResult();
    buf = readFileSync(path);
  } catch {
    return emptyResult();
  }
  const text = unmetafy(buf).toString("utf8");
  const { items, skipped } = parseZshText(text);
  return { items, found: true, skipped };
}
