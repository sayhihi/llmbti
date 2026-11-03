/**
 * 반블록 ANSI 렌더러 (SPEC 10장).
 *
 * `▀` 한 글자가 세로 픽셀 두 개를 맡는다. 전경색 = 위 픽셀, 배경색 = 아래 픽셀.
 * 32×32 프레임 → 16줄. 위만 있으면 `▀`(배경 기본값), 아래만 있으면 `▄`, 둘 다 없으면 공백.
 * 애니메이션은 하지 않고 프레임 하나만 찍는다.
 */

import {
  PALETTE,
  TRANSPARENT_CHAR,
  type Palette,
  type PixelCharacter,
  type PixelFrame,
} from "@llmbit/core";

import { BG_DEFAULT, RESET, bgCode, fgCode, type ColorMode } from "./color";

export const UPPER_HALF = "▀";
export const LOWER_HALF = "▄";

export interface RenderOptions {
  mode: ColorMode;
  /** 프레임 인덱스. 기본 0. 범위를 벗어나면 0. */
  frame?: number;
  /** 기본 PALETTE */
  palette?: Palette;
}

function colorAt(row: string | undefined, x: number, palette: Palette): string | null {
  const ch = row?.[x];
  if (ch === undefined || ch === TRANSPARENT_CHAR) return null;
  return palette[parseInt(ch, 16)] ?? null;
}

/**
 * 프레임 하나를 반블록 줄 배열로. 줄 수 = ceil(rows / 2).
 * none 모드면 빈 배열(캐릭터 생략). 색 코드는 바뀔 때만 내보내고 줄 끝에서 리셋한다.
 */
export function renderFrameAnsi(frame: PixelFrame, palette: Palette, mode: ColorMode): string[] {
  if (mode === "none") return [];

  const width = frame.reduce((m, r) => Math.max(m, r.length), 0);
  const lines: string[] = [];

  for (let y = 0; y < frame.length; y += 2) {
    const top = frame[y];
    const bottom = frame[y + 1];
    let out = "";
    let curFg: string | null = null;
    let curBg: string | null = null;
    let dirty = false;

    for (let x = 0; x < width; x++) {
      const t = colorAt(top, x, palette);
      const b = colorAt(bottom, x, palette);

      if (t === null && b === null) {
        if (dirty) {
          out += RESET;
          curFg = null;
          curBg = null;
          dirty = false;
        }
        out += " ";
        continue;
      }

      const fg = t ?? b!;
      const bg = t !== null ? b : null;
      if (fg !== curFg) {
        out += fgCode(mode, fg);
        curFg = fg;
      }
      if (bg !== curBg) {
        out += bg === null ? BG_DEFAULT : bgCode(mode, bg);
        curBg = bg;
      }
      dirty = true;
      out += t !== null ? UPPER_HALF : LOWER_HALF;
    }

    if (dirty) out += RESET;
    lines.push(out);
  }

  return lines;
}

/**
 * 캐릭터 한 프레임을 16줄 ANSI 문자열로. none 모드면 `[]`.
 * 호출자가 `[]`를 받으면 캐릭터 자리를 생략하고 텍스트만 찍는다.
 */
export function renderCharacterAnsi(character: PixelCharacter, options: RenderOptions): string[] {
  if (options.mode === "none") return [];
  const idx = options.frame ?? 0;
  const frame = character.frames[idx] ?? character.frames[0];
  if (!frame) return [];
  return renderFrameAnsi(frame, options.palette ?? PALETTE, options.mode);
}
