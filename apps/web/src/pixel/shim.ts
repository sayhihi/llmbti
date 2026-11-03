/**
 * 픽셀 캐릭터 렌더러 shim (M2).
 *
 * 렌더러 에이전트가 같은 계약을 @llmbit/core에 구현하고 있다. 머지 후 이 파일은
 *   export { PALETTE, getCharacter, drawFrame } from "@llmbit/core";
 * 한 줄로 바뀐다. 그때까지는 core의 JSON을 직접 읽어서 같은 동작을 낸다.
 */

import paletteJson from "../../../../packages/core/src/palette.json";
import ENFP from "../../../../packages/core/src/characters/ENFP.json";
import INTJ from "../../../../packages/core/src/characters/INTJ.json";
import ISTP from "../../../../packages/core/src/characters/ISTP.json";

export type PixelFrame = string[];

export interface PixelCharacter {
  id: string;
  size: number;
  fps: number;
  frames: PixelFrame[];
}

/** 인덱스가 곧 팔레트 번호. 0번(투명)은 null. */
export type Palette = (string | null)[];

export const PALETTE: Palette = [...paletteJson.colors]
  .sort((a, b) => a.index - b.index)
  .map((c) => c.hex);

const CHARACTERS: Record<string, PixelCharacter> = Object.fromEntries(
  [INTJ, ENFP, ISTP].map((c) => [c.id, c as PixelCharacter]),
);

/** 아직 픽셀 데이터가 없는 유형은 null. 호출 측이 placeholder를 그린다. */
export function getCharacter(type: string): PixelCharacter | null {
  return CHARACTERS[type] ?? null;
}

/** '.'은 투명, 16진수 문자 하나는 팔레트 인덱스. 캔버스를 비우고 한 프레임을 정수 배율로 찍는다. */
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  frame: PixelFrame,
  palette: Palette,
  scale: number,
): void {
  const s = Math.max(1, Math.floor(scale));
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  for (let y = 0; y < frame.length; y++) {
    const row = frame[y] ?? "";
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === "." || ch === undefined) continue;
      const idx = parseInt(ch, 16);
      if (Number.isNaN(idx)) continue;
      const color = palette[idx];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x * s, y * s, s, s);
    }
  }
}
