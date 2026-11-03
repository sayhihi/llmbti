/**
 * 페이지 색은 캐릭터 팔레트(packages/core/src/palette.json)와 공유한다.
 * 팔레트 이름을 그대로 CSS 변수 `--p-<name>` 로 올린다. styles.css 는 이 변수를 쓴다.
 */

import paletteJson from "../../../packages/core/src/palette.json";
import type { Temperament } from "@llmbit/core";

export function applyPaletteVars(root: HTMLElement = document.documentElement) {
  for (const color of paletteJson.colors) {
    if (!color.hex) continue;
    root.style.setProperty(`--p-${color.name}`, color.hex);
  }
}

/** 기질별 몸 색 변수 이름. 카드 테두리, 게이지 등에 쓴다. */
export function temperamentVar(t: Temperament): string {
  return `var(--p-${t.toLowerCase()}-base)`;
}

export function temperamentShadowVar(t: Temperament): string {
  return `var(--p-${t.toLowerCase()}-shadow)`;
}
