/**
 * 통계 배지 키 -> 한글 라벨. 배지 라벨은 이 파일 한 곳에만 둔다.
 *
 * 키 목록의 소유자는 분석 엔진이다 (@llmbti/core 의 BADGE_KEYS, 9종).
 * stat 은 payload.stats 의 키 이름이고 엔진의 Stats 와 1:1 이다. nightRatio 는 이미 퍼센트 정수다.
 * 모르는 키는 raw 그대로 보여 준다. 그래야 엔진 쪽에서 키를 추가해도 페이지가 깨지지 않는다.
 */

import type { BadgeKey } from "@llmbti/core";

export interface BadgeLabel {
  /** 칩에 보이는 이름 */
  label: string;
  /** payload.stats 에서 같이 보여 줄 숫자 키 */
  stat?: string;
  /** 숫자 뒤에 붙는 단위. 예: "번", "%" */
  unit?: string;
}

export const BADGE_LABELS: Record<BadgeKey, BadgeLabel> = {
  nightOwl: { label: "새벽 코더", stat: "nightRatio", unit: "%" },
  forcePusher: { label: "--force 장인", stat: "forceCount", unit: "번" },
  rmrfSurvivor: { label: "rm -rf 생존자", stat: "rmrfCount", unit: "번" },
  sudoBanger: { label: "sudo !! 애호가", stat: "sudoBangCount", unit: "번" },
  thankYouBot: { label: "고마워 담당", stat: "thanksCount", unit: "번" },
  redoLoop: { label: "다시 다시", stat: "redoCount", unit: "번" },
  marathonSession: { label: "세션 마라토너", stat: "longestSession", unit: "턴" },
  oneWordWonder: { label: "한 단어 프롬프트" },
  lowSample: { label: "표본 적음", stat: "promptCount", unit: "개" },
};

export interface BadgeChip {
  key: string;
  label: string;
  /** 포맷된 숫자. 없으면 라벨만 */
  value: string | null;
  known: boolean;
}

/** 배지 키와 통계를 칩 하나로. 모르는 키는 raw 키를 라벨로 쓴다. */
export function badgeChip(key: string, stats: Record<string, number> = {}): BadgeChip {
  const meta = (BADGE_LABELS as Record<string, BadgeLabel | undefined>)[key];
  if (!meta) return { key, label: key, value: null, known: false };
  let value: string | null = null;
  if (meta.stat !== undefined) {
    const n = stats[meta.stat];
    if (typeof n === "number" && Number.isFinite(n)) {
      value = `${Math.round(n)}${meta.unit ?? ""}`;
    }
  }
  return { key, label: meta.label, value, known: true };
}

export function badgeChips(keys: string[], stats?: Record<string, number>): BadgeChip[] {
  return keys.map((k) => badgeChip(k, stats));
}
