/**
 * 표시 폭 기준 줄바꿈. 한글은 2칸으로 센다 (displayWidth).
 * 공백에서 끊는 걸 우선하고, 한 단어가 폭보다 길면 글자 단위로 자른다. ANSI 코드가 없는 텍스트용.
 */

import { displayWidth } from "./color";

export function wrapText(text: string, width: number): string[] {
  const w = Math.max(1, Math.floor(width));
  // 폭 안에 들어가면 공백까지 그대로 둔다 (`ENFP  별명` 같은 헤더 간격 유지).
  if (displayWidth(text) <= w) return [text];
  const lines: string[] = [];
  let current = "";

  const pushWord = (word: string): void => {
    if (displayWidth(word) <= w) {
      current = word;
      return;
    }
    // 폭보다 긴 단어는 글자 단위로
    let chunk = "";
    for (const ch of word) {
      if (displayWidth(chunk + ch) > w) {
        lines.push(chunk);
        chunk = "";
      }
      chunk += ch;
    }
    current = chunk;
  };

  for (const word of text.split(/\s+/).filter((s) => s !== "")) {
    if (current === "") {
      pushWord(word);
    } else if (displayWidth(current + " " + word) <= w) {
      current += " " + word;
    } else {
      lines.push(current);
      pushWord(word);
    }
  }
  if (current !== "" || lines.length === 0) lines.push(current);
  return lines;
}

/** 여러 줄을 각각 wrap. 빈 줄은 그대로 둔다. */
export function wrapLines(lines: readonly string[], width: number): string[] {
  return lines.flatMap((l) => (l === "" ? [""] : wrapText(l, width)));
}
