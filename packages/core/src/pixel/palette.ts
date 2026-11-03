import paletteJson from "../palette.json";
import { PALETTE_SIZE, type Palette } from "./types";

interface PaletteJson {
  colors: Array<{ index: number; name: string; hex: string | null }>;
}

const colors = (paletteJson as PaletteJson).colors;

/**
 * 공통 16색 팔레트. index 0은 투명(null).
 * 원본은 `packages/core/src/palette.json`이고, `scripts/pixel-validate.mjs`가 검증한다.
 */
export const PALETTE: Palette = colors.map((c) => c.hex);

/** 팔레트 이름 (디버그·도감용). index 순서. */
export const PALETTE_NAMES: readonly string[] = colors.map((c) => c.name);

if (PALETTE.length !== PALETTE_SIZE || PALETTE[0] !== null) {
  throw new Error(`palette.json must have ${PALETTE_SIZE} colors with index 0 transparent`);
}

/** `#RRGGBB` → [r, g, b]. 잘못된 입력이면 null. */
export function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}
