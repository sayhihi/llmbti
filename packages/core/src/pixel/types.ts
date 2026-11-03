/**
 * 픽셀 캐릭터 데이터 타입 (SPEC 10장).
 *
 * 한 프레임은 32줄, 한 줄은 32글자. `.`은 투명, `1`~`f`는 팔레트 인덱스다.
 * 터미널 렌더러(cli)와 캔버스 렌더러(web)가 같은 타입을 쓴다.
 */

/** 32줄 × 32글자. 글자 하나가 픽셀 하나. */
export type PixelFrame = string[];

export interface PixelCharacter {
  /** MBTI 유형 또는 "_base" */
  id: string;
  /** 한 변의 픽셀 수. 현재는 항상 32. */
  size: number;
  /** idle 애니메이션 프레임 속도 */
  fps: number;
  /** 2~4프레임. 최소 1개. */
  frames: PixelFrame[];
}

/** 16개 항목. 0번은 투명(null), 나머지는 `#RRGGBB`. */
export type Palette = (string | null)[];

export const PIXEL_SIZE = 32;
export const PALETTE_SIZE = 16;
export const TRANSPARENT_CHAR = ".";
