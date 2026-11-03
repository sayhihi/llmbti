import { TRANSPARENT_CHAR, type Palette, type PixelFrame } from "./types";

/**
 * 캔버스 2D 컨텍스트의 부분집합. 테스트에서 가짜 객체를 넣기 쉽도록 최소만 요구한다.
 * 실제 `CanvasRenderingContext2D`를 그대로 넘기면 된다.
 */
export interface DrawContext {
  fillStyle: unknown;
  fillRect(x: number, y: number, w: number, h: number): void;
  clearRect(x: number, y: number, w: number, h: number): void;
}

/** 프레임 하나의 픽셀 크기. 캔버스 width/height 계산용. */
export function frameSize(frame: PixelFrame): { width: number; height: number } {
  return {
    width: frame.reduce((m, r) => Math.max(m, r.length), 0),
    height: frame.length,
  };
}

/**
 * 프레임 하나를 정수 배율로 그린다. 먼저 전체를 지우고, 투명이 아닌 픽셀마다 fillRect 한 번.
 * 캔버스 크기는 `width * scale` × `height * scale`이어야 한다. 호출자가 `image-rendering: pixelated`를 건다.
 */
export function drawFrame(
  ctx: DrawContext,
  frame: PixelFrame,
  palette: Palette,
  scale: number,
): void {
  const { width, height } = frameSize(frame);
  ctx.clearRect(0, 0, width * scale, height * scale);

  for (let y = 0; y < height; y++) {
    const row = frame[y]!;
    for (let x = 0; x < row.length; x++) {
      const ch = row[x]!;
      if (ch === TRANSPARENT_CHAR) continue;
      const color = palette[parseInt(ch, 16)];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }
}
