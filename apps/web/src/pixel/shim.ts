/**
 * 픽셀 캐릭터 API. 구현은 @llmbti/core 에 있고 여기서는 재노출만 한다.
 * getCharacter 만 string 을 받도록 감싼다 (라우트 파라미터가 string 이라서).
 */
import { getCharacter as coreGetCharacter, isMbtiType } from "@llmbti/core";
import type { PixelCharacter } from "@llmbti/core";

export type { PixelFrame, PixelCharacter, Palette } from "@llmbti/core";
export { PALETTE, drawFrame, getAnim } from "@llmbti/core";

/** 아직 픽셀 데이터가 없는 유형이나 모르는 문자열은 null. 호출 측이 placeholder 를 그린다. */
export function getCharacter(type: string): PixelCharacter | null {
  return isMbtiType(type) ? coreGetCharacter(type) : null;
}
