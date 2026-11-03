import { MBTI_TYPES, type MbtiType } from "../types";
import baseJson from "../characters/_base.json";
import INTJ from "../characters/INTJ.json";
import INTP from "../characters/INTP.json";
import ENTJ from "../characters/ENTJ.json";
import ENTP from "../characters/ENTP.json";
import INFJ from "../characters/INFJ.json";
import INFP from "../characters/INFP.json";
import ENFJ from "../characters/ENFJ.json";
import ENFP from "../characters/ENFP.json";
import ISTJ from "../characters/ISTJ.json";
import ISFJ from "../characters/ISFJ.json";
import ESTJ from "../characters/ESTJ.json";
import ESFJ from "../characters/ESFJ.json";
import ISTP from "../characters/ISTP.json";
import ISFP from "../characters/ISFP.json";
import ESTP from "../characters/ESTP.json";
import ESFP from "../characters/ESFP.json";
import type { PixelCharacter } from "./types";
import { validateCharacter } from "./validate";

export type CharacterId = MbtiType | "_base";

/** 그려진 캐릭터 레지스트리. _base + 16종 전부 (M3 2라운드). */
const REGISTRY: Partial<Record<CharacterId, PixelCharacter>> = Object.fromEntries(
  [baseJson, INTJ, INTP, ENTJ, ENTP, INFJ, INFP, ENFJ, ENFP, ISTJ, ISFJ, ESTJ, ESFJ, ISTP, ISFP, ESTP, ESFP].map((c: unknown) => {
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
