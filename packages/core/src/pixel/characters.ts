import { MBTI_TYPES, type MbtiType } from "../types";
import baseJson from "../characters/_base.json";
import ENFP from "../characters/ENFP.json";
import INTJ from "../characters/INTJ.json";
import ISTP from "../characters/ISTP.json";
import type { PixelCharacter } from "./types";
import { validateCharacter } from "./validate";

export type CharacterId = MbtiType | "_base";

/**
 * 그려진 캐릭터 레지스트리. 픽셀 에이전트가 json을 추가하면 import 하나와 아래 배열에 한 줄 더한다.
 * (M3: _base + INTJ, ENFP, ISTP. 나머지 13종은 M6.)
 */
const REGISTRY: Partial<Record<CharacterId, PixelCharacter>> = Object.fromEntries(
  [baseJson, INTJ, ENFP, ISTP].map((c: unknown) => {
    validateCharacter(c);
    return [c.id, c] as const;
  }),
);

/** 유형별 캐릭터. 아직 안 그린 유형이면 null. */
export function getCharacter(type: CharacterId): PixelCharacter | null {
  return REGISTRY[type] ?? null;
}

export function hasCharacter(type: MbtiType): boolean {
  return REGISTRY[type] !== undefined;
}

/**
 * 이름 붙은 프레임 순서. `anims[name]`이 없으면 frames 전체를 순서대로 (0..n-1).
 * 터미널은 `getAnim(c, "idle")[0]` 한 장만 찍고, 웹은 fps에 맞춰 순서대로 돌린다.
 */
export function getAnim(character: PixelCharacter, name: string): number[] {
  const seq = character.anims?.[name];
  if (seq && seq.length > 0) return [...seq];
  return character.frames.map((_, i) => i);
}

/** 그려진 MBTI 유형 목록 (MBTI_TYPES 순서, _base 제외). */
export const DRAWN_TYPES: readonly MbtiType[] = MBTI_TYPES.filter((t) => REGISTRY[t] !== undefined);
