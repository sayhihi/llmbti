/**
 * 인수인계 네 항목(CopyJson.handover)을 후임 AI에게 쓰는 편지로 잇는다. 웹 결과 페이지와 CLI 터미널 출력이 같이 쓴다.
 *
 *   나를 이을 후임 AI에게.            ← 제목
 *   이 사용자는 {style}               ← style 이 주어로 시작하지 않으면 "이 사용자는" 을 붙인다
 *   {likes}
 *   {dislikes}
 *   {soothe}
 *   부탁한다.
 *                       전임 AI 올림
 */

import { HANDOVER_KEYS } from "./types";
import type { Handover } from "./types";

export const HANDOVER_TITLE = "나를 이을 후임 AI에게";
export const HANDOVER_CLOSING = "부탁한다.";
export const HANDOVER_SIGN = "전임 AI 올림";

/** style 이 이미 주어로 시작하면 "이 사용자는" 을 붙이지 않는다. */
const SUBJECT_RE = /^(이 사용자는|이 사용자,|이분은|이 분은|이 사람은|우리 사용자는)/;

/** 본문 줄. 빈 항목은 건너뛴다. 항목이 전부 비면 빈 배열. */
export function handoverLetterLines(h: Handover): string[] {
  const lines: string[] = [];
  for (const k of HANDOVER_KEYS) {
    const t = (h[k] ?? "").trim();
    if (t === "") continue;
    lines.push(k === "style" && !SUBJECT_RE.test(t) ? `이 사용자는 ${t}` : t);
  }
  return lines;
}
