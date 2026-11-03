import { PIXEL_SIZE, TRANSPARENT_CHAR, type PixelCharacter } from "./types";

export class PixelCharacterError extends Error {
  override name = "PixelCharacterError";
}

function fail(msg: string): never {
  throw new PixelCharacterError(msg);
}

/**
 * 캐릭터 JSON의 모양을 검증한다. `scripts/pixel-validate.mjs`와 같은 규칙.
 * - size 32, fps 양수, frames 1개 이상
 * - 프레임마다 32줄, 줄마다 32글자
 * - 글자는 `.` 또는 `1`~`f` (`0`은 투명이므로 `.`을 써야 한다)
 */
export function validateCharacter(c: unknown): asserts c is PixelCharacter {
  if (typeof c !== "object" || c === null) fail("character must be an object");
  const o = c as Record<string, unknown>;
  const label = typeof o.id === "string" && o.id ? o.id : "character";

  if (typeof o.id !== "string" || !o.id) fail("character.id must be a non-empty string");
  if (o.size !== PIXEL_SIZE) fail(`${label}: size must be ${PIXEL_SIZE}, got ${String(o.size)}`);
  if (typeof o.fps !== "number" || !Number.isFinite(o.fps) || o.fps <= 0)
    fail(`${label}: fps must be a positive number`);
  if (!Array.isArray(o.frames) || o.frames.length === 0)
    fail(`${label}: frames must be a non-empty array`);

  o.frames.forEach((frame: unknown, fi: number) => {
    if (!Array.isArray(frame) || frame.length !== PIXEL_SIZE)
      fail(
        `${label}: frame ${fi} has ${Array.isArray(frame) ? frame.length : "no"} rows, expected ${PIXEL_SIZE}`,
      );
    frame.forEach((row: unknown, ri: number) => {
      if (typeof row !== "string" || row.length !== PIXEL_SIZE)
        fail(
          `${label}: frame ${fi} row ${ri} has length ${typeof row === "string" ? row.length : "n/a"}, expected ${PIXEL_SIZE}`,
        );
      for (let ci = 0; ci < row.length; ci++) {
        const ch = row[ci]!;
        if (ch === TRANSPARENT_CHAR) continue;
        if (!/^[1-9a-f]$/.test(ch))
          fail(`${label}: frame ${fi} row ${ri} col ${ci}: invalid char "${ch}"`);
      }
    });
  });
}
