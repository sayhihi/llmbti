/**
 * bash 히스토리 파서 (`~/.bash_history`).
 *
 * - 기본은 한 줄에 명령 하나, ts 없음.
 * - HISTTIMEFORMAT이 설정돼 있으면 명령 앞줄에 `#1699999999` 형태의 epoch 초 주석이 붙는다. 다음 명령의 ts로 쓴다.
 * - 줄 끝 `\` 이어짐은 zsh와 같이 합친다.
 */

import type { ParseResult, ShellEvent } from "./common";
import { emptyResult, readTextSafe, splitLines } from "./common";

const TIMESTAMP_COMMENT = /^#(\d{9,11})$/;

export function parseBashText(text: string): { items: ShellEvent[]; skipped: number } {
  const items: ShellEvent[] = [];
  let skipped = 0;
  const lines = splitLines(text);
  let pendingTs: number | undefined;
  let i = 0;
  while (i < lines.length) {
    let line = lines[i]!;
    i++;
    const tsMatch = TIMESTAMP_COMMENT.exec(line);
    if (tsMatch) {
      pendingTs = Number(tsMatch[1]) * 1000;
      continue;
    }
    while (line.endsWith("\\") && i < lines.length) {
      line = line.slice(0, -1) + "\n" + lines[i]!;
      i++;
    }
    const command = line.trim();
    if (command === "") {
      // 빈 줄은 깨진 줄로 보지 않는다. 단 ts 주석 뒤에 빈 명령이면 센다.
      if (pendingTs !== undefined) skipped++;
      pendingTs = undefined;
      continue;
    }
    items.push(pendingTs === undefined ? { command } : { command, ts: pendingTs });
    pendingTs = undefined;
  }
  return { items, skipped };
}

export function parseBashHistory(path: string): ParseResult<ShellEvent> {
  const text = readTextSafe(path);
  if (text === null) return emptyResult();
  const { items, skipped } = parseBashText(text);
  return { items, found: true, skipped };
}
