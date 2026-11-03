/**
 * 터미널 결과 레이아웃 (SPEC 12장).
 *
 * 왼쪽에 캐릭터 16줄, 오른쪽에 유형·별명·4축 바·evidence. 폭이 80칸 미만이면 세로로 쌓는다.
 */

import { AXES, type Axis, type Scores } from "@llmbti/core";

import { displayWidth } from "./color";

/** 이 폭 미만이면 세로 스택 */
export const SIDE_BY_SIDE_MIN_WIDTH = 80;

export interface LayoutOptions {
  /** renderCharacterAnsi 결과. 빈 배열이면 텍스트만 돌려준다. */
  characterLines: readonly string[];
  /** 오른쪽(또는 아래) 텍스트 줄 */
  rightLines: readonly string[];
  /** 터미널 폭(칸). 보통 process.stdout.columns */
  width: number;
  /** 캐릭터와 텍스트 사이 칸 수. 기본 2 */
  gap?: number;
}

/**
 * 캐릭터와 텍스트를 합친 줄 배열. 줄바꿈은 포함하지 않는다.
 * - 캐릭터가 없으면 rightLines 그대로
 * - width < 80이면 캐릭터, 빈 줄, 텍스트 순으로 세로 스택
 * - 아니면 캐릭터를 왼쪽 고정 폭으로 두고 오른쪽에 텍스트. 오른쪽 줄은 자르지 않는다.
 */
export function layoutResult(opts: LayoutOptions): string[] {
  const { characterLines, rightLines, width } = opts;
  const gap = Math.max(0, opts.gap ?? 2);

  if (characterLines.length === 0) return [...rightLines];
  if (width < SIDE_BY_SIDE_MIN_WIDTH) return [...characterLines, "", ...rightLines];

  const leftWidth = characterLines.reduce((m, l) => Math.max(m, displayWidth(l)), 0);
  const count = Math.max(characterLines.length, rightLines.length);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const left = characterLines[i] ?? "";
    const right = rightLines[i] ?? "";
    if (right === "") {
      out.push(left);
      continue;
    }
    const pad = " ".repeat(leftWidth - displayWidth(left) + gap);
    out.push(left + pad + right);
  }
  return out;
}

export interface AxisBarOptions {
  /** 바 칸 수. 기본 6 */
  width?: number;
  filled?: string;
  empty?: string;
}

/**
 * `E ████░░ I` 형태. score는 -100..100, 양수면 왼쪽 글자 쪽으로 채운다.
 * score 0 → 반만, +100 → 전부, -100 → 비움.
 */
export function axisBar(
  left: string,
  right: string,
  score: number,
  opts: AxisBarOptions = {},
): string {
  const width = Math.max(1, opts.width ?? 6);
  const filled = opts.filled ?? "█";
  const empty = opts.empty ?? "░";
  const clamped = Math.max(-100, Math.min(100, Number.isFinite(score) ? score : 0));
  const n = Math.round(((clamped + 100) / 200) * width);
  return `${left} ${filled.repeat(n)}${empty.repeat(width - n)} ${right}`;
}

/** 4축 바 4줄. EI, SN, TF, JP 순. */
export function axisBars(scores: Scores, opts: AxisBarOptions = {}): string[] {
  return AXES.map((axis: Axis) => axisBar(axis[0]!, axis[1]!, scores[axis], opts));
}
