/**
 * 공유 카드 PNG (1200×630). 클라이언트 canvas 에서 그린다 (SPEC 13장 7번).
 * 그리기(drawShareCard)는 최소 컨텍스트 인터페이스만 써서 테스트에서 가짜 2D 컨텍스트를 넣을 수 있다.
 * 레이아웃: 왼쪽에 캐릭터(idle 첫 프레임, 정수 배율), 오른쪽에 TYPE(픽셀 폰트), 별명, roast(≤3줄), 4축 미니 바, 푸터.
 */

import { AXES, PALETTE, TEMPERAMENT_OF, TEMPERAMENT_PALETTE, drawFrame } from "@llmbti/core";
import type { Axis, MbtiType, PixelCharacter, Scores } from "@llmbti/core";

import { planAnims } from "../pixel/player";

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;
export const SITE_HOST = "llmbti.vercel.app";

/** 한글은 모노스페이스 스택, 영문 포인트는 픽셀 폰트 (index.html 의 웹폰트) */
export const MONO_FONT = 'ui-monospace, "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace';
export const PIXEL_FONT = '"Press Start 2P", ' + MONO_FONT;

const BG = PALETTE[1] ?? "#111111"; // black
const FG = PALETTE[2] ?? "#FAFAFA"; // white
const DIM = PALETTE[4] ?? "#C4C4C4"; // grey-light
const TRACK = PALETTE[3] ?? "#5C5C5C"; // grey-dark

const AXIS_LETTERS: Record<Axis, [string, string]> = {
  EI: ["E", "I"],
  SN: ["S", "N"],
  TF: ["T", "F"],
  JP: ["J", "P"],
};

/** 그리는 데 필요한 canvas 2D 의 부분집합 */
export interface CardContext {
  fillStyle: unknown;
  strokeStyle: unknown;
  lineWidth: number;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  imageSmoothingEnabled: boolean;
  fillRect(x: number, y: number, w: number, h: number): void;
  strokeRect(x: number, y: number, w: number, h: number): void;
  clearRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number): void;
  measureText(text: string): { width: number };
  save(): void;
  restore(): void;
  translate(x: number, y: number): void;
  setLineDash?(segments: number[]): void;
}

export interface CardInput {
  type: MbtiType;
  nickname: string;
  roast: string;
  scores: Scores;
  /** 없으면 글자 박스를 그린다 */
  character: PixelCharacter | null;
}

/** 기질 몸 색 [기본, 그림자] */
export function accentOf(type: MbtiType): { base: string; shadow: string } {
  const [b, s] = TEMPERAMENT_PALETTE[TEMPERAMENT_OF(type)];
  return { base: PALETTE[b] ?? "#E0654E", shadow: PALETTE[s] ?? "#B5452F" };
}

/**
 * 폭에 맞춰 줄을 나눈다. 공백이 있으면 단어 단위로, 없으면(한글 긴 문장) 글자 단위로 끊는다.
 * maxLines 를 넘기면 마지막 줄 끝을 "…" 로 자른다.
 */
export function wrapText(
  measure: (s: string) => number,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const chars = [...text.replace(/\s+/g, " ").trim()];
  const lines: string[] = [];
  let line = "";
  let i = 0;
  while (i < chars.length) {
    const ch = chars[i]!;
    if (line === "" || measure(line + ch) <= maxWidth) {
      line += ch;
      i++;
      continue;
    }
    // 넘쳤다. 공백에서 넘쳤으면 거기서, 줄 안에 공백이 있으면 그 단어 앞에서, 없으면 글자에서 끊는다.
    const space = line.lastIndexOf(" ");
    if (ch === " ") {
      lines.push(line);
      line = "";
      i++; // 새 줄은 공백으로 시작하지 않는다
    } else if (space > 0) {
      lines.push(line.slice(0, space));
      line = line.slice(space + 1);
    } else {
      lines.push(line);
      line = "";
    }
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines) {
    if (line.trim()) lines.push(line.trim());
    return lines;
  }
  const remaining = (line + chars.slice(i).join("")).trim();
  if (!remaining) return lines;
  let last = lines[maxLines - 1] ?? "";
  while (last.length > 0 && measure(last + "…") > maxWidth) {
    last = [...last].slice(0, -1).join("").trimEnd();
  }
  lines[maxLines - 1] = last + "…";
  return lines;
}

/** 카드 전체를 그린다. ctx 크기는 CARD_WIDTH × CARD_HEIGHT 여야 한다. */
export function drawShareCard(ctx: CardContext, input: CardInput): void {
  const { type, nickname, roast, scores, character } = input;
  const accent = accentOf(type);

  // 배경
  ctx.clearRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  // 위쪽 기질 색 줄
  ctx.fillStyle = accent.base;
  ctx.fillRect(0, 0, CARD_WIDTH, 10);

  // 왼쪽: 캐릭터
  const charBox = { x: 56, y: 70, w: 400, h: 490 };
  if (character) {
    const scale = Math.max(1, Math.floor(Math.min(charBox.w, charBox.h) / character.size));
    const size = character.size * scale;
    const ox = charBox.x + Math.floor((charBox.w - size) / 2);
    const oy = charBox.y + Math.floor((charBox.h - size) / 2);
    const frame = character.frames[planAnims(character).idle[0] ?? 0];
    if (frame) {
      ctx.save();
      ctx.translate(ox, oy);
      ctx.imageSmoothingEnabled = false;
      // drawFrame 은 clearRect 로 시작한다. 배경이 투명해지지 않게 clearRect 만 막는다.
      drawFrame(
        {
          get fillStyle() {
            return ctx.fillStyle;
          },
          set fillStyle(v) {
            ctx.fillStyle = v;
          },
          fillRect: (x, y, w, h) => ctx.fillRect(x, y, w, h),
          clearRect: () => {},
        },
        frame,
        PALETTE,
        scale,
      );
      ctx.restore();
    }
  } else {
    // 데이터가 없는 유형: 점선 박스 + 글자
    const size = 320;
    const ox = charBox.x + Math.floor((charBox.w - size) / 2);
    const oy = charBox.y + Math.floor((charBox.h - size) / 2);
    ctx.fillStyle = accent.shadow;
    ctx.fillRect(ox, oy, size, size);
    ctx.fillStyle = accent.base;
    ctx.fillRect(ox + 12, oy + 12, size - 24, size - 24);
    ctx.strokeStyle = BG;
    ctx.lineWidth = 4;
    ctx.setLineDash?.([12, 8]);
    ctx.strokeRect(ox + 24, oy + 24, size - 48, size - 48);
    ctx.setLineDash?.([]);
    ctx.fillStyle = BG;
    ctx.font = `48px ${PIXEL_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(type, ox + size / 2, oy + size / 2);
  }

  // 오른쪽 글
  const left = 500;
  const right = CARD_WIDTH - 56;
  const width = right - left;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = DIM;
  ctx.font = `22px ${MONO_FONT}`;
  ctx.fillText("$ npx llmbti", left, 96);

  ctx.fillStyle = accent.base;
  ctx.font = `72px ${PIXEL_FONT}`;
  ctx.fillText(type, left, 190);

  ctx.fillStyle = FG;
  ctx.font = `bold 40px ${MONO_FONT}`;
  ctx.fillText(nickname, left, 252);

  ctx.fillStyle = FG;
  ctx.font = `26px ${MONO_FONT}`;
  const lines = wrapText((s) => ctx.measureText(s).width, roast, width, 3);
  lines.forEach((line, i) => ctx.fillText(line, left, 310 + i * 40));

  // 4축 미니 바
  const barTop = 450;
  const rowH = 30;
  const letterW = 40;
  const trackX = left + letterW + 8;
  const trackW = width - (letterW + 8) * 2;
  AXES.forEach((axis, i) => {
    const y = barTop + i * rowH;
    const score = Math.max(-100, Math.min(100, Math.round(scores[axis] ?? 0)));
    const [l, r] = AXIS_LETTERS[axis];
    const leftWins = score >= 0;
    ctx.font = `18px ${PIXEL_FONT}`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillStyle = leftWins ? accent.base : DIM;
    ctx.fillText(l, left, y + 7);
    ctx.textAlign = "right";
    ctx.fillStyle = leftWins ? DIM : accent.base;
    ctx.fillText(r, right, y + 7);
    // 트랙
    ctx.fillStyle = TRACK;
    ctx.fillRect(trackX, y, trackW, 14);
    // 가운데 눈금
    ctx.fillStyle = BG;
    ctx.fillRect(trackX + trackW / 2 - 1, y - 3, 2, 20);
    // 채움: 가운데에서 이긴 쪽으로
    const half = trackW / 2;
    const len = (Math.abs(score) / 100) * half;
    ctx.fillStyle = accent.base;
    if (leftWins) ctx.fillRect(trackX + half - len, y, len, 14);
    else ctx.fillRect(trackX + half, y, len, 14);
  });

  // 푸터
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = DIM;
  ctx.font = `16px ${PIXEL_FONT}`;
  ctx.fillText(SITE_HOST, right, CARD_HEIGHT - 32);
}

/** 픽셀 웹폰트가 로드될 때까지 기다린다. 못 기다리는 환경이면 그냥 넘어간다. */
export async function ensureFonts(): Promise<void> {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  try {
    await Promise.all([
      document.fonts.load(`72px ${PIXEL_FONT}`),
      document.fonts.load(`18px ${PIXEL_FONT}`),
      document.fonts.load(`16px ${PIXEL_FONT}`),
    ]);
    await document.fonts.ready;
  } catch {
    // 폰트 없이 그린다
  }
}

/** 브라우저에서 카드 PNG Blob 을 만든다. */
export async function renderShareCard(input: CardInput): Promise<Blob> {
  await ensureFonts();
  const canvas = document.createElement("canvas");
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context unavailable");
  drawShareCard(ctx, input);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))), "image/png");
  });
}

export function cardFileName(type: MbtiType): string {
  return `llmbti-${type}.png`;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
