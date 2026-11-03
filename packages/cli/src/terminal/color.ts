/**
 * 터미널 색 모드 판정과 ANSI 색 코드 (SPEC 10장 렌더러 fallback 순서).
 *
 * truecolor (COLORTERM=truecolor|24bit) → 256 (TERM에 256color) → none (NO_COLOR, 파이프, --no-color)
 */

import { hexToRgb } from "@llmbti/core";

export type ColorMode = "truecolor" | "256" | "none";

export const COLOR_MODES: readonly ColorMode[] = ["truecolor", "256", "none"];

export function isColorMode(value: unknown): value is ColorMode {
  return typeof value === "string" && (COLOR_MODES as readonly string[]).includes(value);
}

export interface DetectColorModeOptions {
  /** 기본 process.env */
  env?: Record<string, string | undefined>;
  /** 기본 process.stdout.isTTY */
  isTTY?: boolean;
  /** `--no-color`를 찾을 인자 목록. 기본 process.argv */
  argv?: readonly string[];
}

/**
 * 색 모드 판정. 순서가 중요하다.
 * 1. `--no-color` 인자, `NO_COLOR` 환경변수(비어있지 않을 때, no-color.org), TTY 아님 → none
 * 2. COLORTERM이 truecolor 또는 24bit → truecolor
 * 3. TERM에 256color가 들어가거나, xterm·screen·tmux·rxvt로 시작하거나 vt100·linux면 → 256
 * 4. TERM이 dumb이거나 없으면 → none
 */
export function detectColorMode(opts: DetectColorModeOptions = {}): ColorMode {
  const env = opts.env ?? process.env;
  const isTTY = opts.isTTY ?? Boolean(process.stdout.isTTY);
  const argv = opts.argv ?? process.argv;

  if (argv.includes("--no-color")) return "none";
  if (env.NO_COLOR !== undefined && env.NO_COLOR !== "") return "none";
  if (!isTTY) return "none";

  const colorterm = (env.COLORTERM ?? "").toLowerCase();
  if (colorterm === "truecolor" || colorterm === "24bit") return "truecolor";

  const term = (env.TERM ?? "").toLowerCase();
  if (term.includes("256color")) return "256";
  if (TERM_256_RE.test(term)) return "256";

  return "none";
}

/** 256색을 기대해도 되는 TERM 계열. `dumb`이나 빈 TERM은 여기 안 걸린다. */
const TERM_256_RE = /^(xterm|screen|tmux|rxvt|vt100|linux)/;

// ---------- 256색 양자화 ----------

/** xterm 6×6×6 큐브 단계값 */
const CUBE_LEVELS = [0, 95, 135, 175, 215, 255] as const;

function nearestCubeIndex(v: number): number {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < CUBE_LEVELS.length; i++) {
    const d = Math.abs(CUBE_LEVELS[i]! - v);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

/**
 * RGB → xterm 256색 인덱스. 16~231 큐브와 232~255 회색 중 유클리드 거리가 가까운 쪽.
 * 0~15 시스템 색은 터미널 테마마다 달라서 쓰지 않는다.
 */
export function rgbTo256(r: number, g: number, b: number): number {
  const ri = nearestCubeIndex(r);
  const gi = nearestCubeIndex(g);
  const bi = nearestCubeIndex(b);
  const cubeIdx = 16 + 36 * ri + 6 * gi + bi;
  const cubeDist = dist2(r, g, b, CUBE_LEVELS[ri]!, CUBE_LEVELS[gi]!, CUBE_LEVELS[bi]!);

  // 회색 램프: 8 + 10 * i (i = 0..23)
  const avg = (r + g + b) / 3;
  const gi2 = Math.max(0, Math.min(23, Math.round((avg - 8) / 10)));
  const grey = 8 + 10 * gi2;
  const greyIdx = 232 + gi2;
  const greyDist = dist2(r, g, b, grey, grey, grey);

  return greyDist < cubeDist ? greyIdx : cubeIdx;
}

function dist2(r: number, g: number, b: number, r2: number, g2: number, b2: number): number {
  return (r - r2) ** 2 + (g - g2) ** 2 + (b - b2) ** 2;
}

// ---------- SGR 코드 ----------

export const ESC = "\x1b[";
export const RESET = `${ESC}0m`;
/** 배경만 기본값으로 */
export const BG_DEFAULT = `${ESC}49m`;

/** `#RRGGBB` → 전경 SGR. none 모드이거나 잘못된 hex면 빈 문자열. */
export function fgCode(mode: ColorMode, hex: string): string {
  return sgr(mode, hex, 38);
}

/** `#RRGGBB` → 배경 SGR. none 모드이거나 잘못된 hex면 빈 문자열. */
export function bgCode(mode: ColorMode, hex: string): string {
  return sgr(mode, hex, 48);
}

function sgr(mode: ColorMode, hex: string, layer: 38 | 48): string {
  if (mode === "none") return "";
  const rgb = hexToRgb(hex);
  if (!rgb) return "";
  const [r, g, b] = rgb;
  if (mode === "truecolor") return `${ESC}${layer};2;${r};${g};${b}m`;
  return `${ESC}${layer};5;${rgbTo256(r, g, b)}m`;
}

// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b\[[0-9;]*m/g;

export function stripAnsi(s: string): string {
  return s.replace(ANSI_RE, "");
}

/**
 * 터미널 표시 폭. ANSI 코드는 0, 한글·CJK·전각은 2, 나머지는 1.
 * 반블록(▀▄)과 바(█░)는 1로 센다.
 */
export function displayWidth(s: string): number {
  let w = 0;
  for (const ch of stripAnsi(s)) {
    const cp = ch.codePointAt(0)!;
    if (cp < 0x20 || (cp >= 0x7f && cp < 0xa0)) continue;
    w += isWide(cp) ? 2 : 1;
  }
  return w;
}

function isWide(cp: number): boolean {
  return (
    (cp >= 0x1100 && cp <= 0x115f) || // Hangul Jamo
    (cp >= 0x2e80 && cp <= 0x303e) || // CJK radicals, punctuation
    (cp >= 0x3041 && cp <= 0x33ff) || // kana, hangul compat jamo, enclosed
    (cp >= 0x3400 && cp <= 0x4dbf) || // CJK ext A
    (cp >= 0x4e00 && cp <= 0x9fff) || // CJK unified
    (cp >= 0xa960 && cp <= 0xa97f) || // Hangul Jamo ext A
    (cp >= 0xac00 && cp <= 0xd7a3) || // Hangul syllables
    (cp >= 0xf900 && cp <= 0xfaff) || // CJK compat
    (cp >= 0xfe30 && cp <= 0xfe4f) || // CJK compat forms
    (cp >= 0xff00 && cp <= 0xff60) || // fullwidth forms
    (cp >= 0xffe0 && cp <= 0xffe6) ||
    (cp >= 0x1f300 && cp <= 0x1faff) || // emoji
    (cp >= 0x20000 && cp <= 0x3fffd)
  );
}
