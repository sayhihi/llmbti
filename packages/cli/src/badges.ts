/**
 * 통계 배지 선정 (SPEC 9장 `badges`, 최대 MAX_BADGES개). 결정적: 규칙 순서대로 검사한다.
 * lowSample은 표본 기준이라 stats가 아니라 호출 측이 넘긴다.
 */

import { MAX_BADGES } from "@llmbit/core";
import type { BadgeKey, Stats } from "@llmbit/core";
import { BADGE_RULES, LOW_SAMPLE_PROMPTS } from "./scoring.constants";

export function isLowSample(promptCount: number): boolean {
  return promptCount < LOW_SAMPLE_PROMPTS;
}

export function pickBadges(stats: Stats, lowSample: boolean): BadgeKey[] {
  const badges: BadgeKey[] = [];
  // 표본 적음은 해석에 꼭 필요한 정보라 먼저 넣는다.
  if (lowSample) badges.push("lowSample");
  for (const rule of BADGE_RULES) {
    if (badges.length >= MAX_BADGES) break;
    if (rule.test(stats)) badges.push(rule.key);
  }
  return badges.slice(0, MAX_BADGES);
}
