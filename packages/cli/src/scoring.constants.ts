/**
 * 점수 계산 상수 (SPEC 5장 최소 표본, 6장 시그널 표, 9장 배지). 전부 ⚙️ 튜닝 대상.
 *
 * 시그널 정규화: clamp((x - baseline) / scale, -1, 1)
 * 축 점수:      round(100 * Σ(weight_i * sign_i * norm_i)) , 가중치는 축 안에서 합이 1이 되게 재정규화
 * sign은 +1이면 앞 글자(E, S, T, J) 방향, -1이면 뒷 글자 방향.
 *
 * SPEC과 다르게 정한 것:
 * - scale은 SPEC에 없어서 "기준값 = 스케일"을 기본으로 했다. x=0이면 -1, x=2*기준값이면 +1이 된다.
 *   forceRatio만 기준값 1%가 너무 좁아서 scale을 2%로 넓혔다.
 * - 가중치는 SPEC에 없어서 축 안에서 대략 균등하게 두되 신호가 또렷한 쪽(턴 수, 구체 비율, 계획 신호)에 조금 더 줬다.
 */

import type { Axis, BadgeKey, SignalKey, Stats } from "@llmbti/core";

/** 최소 표본 (SPEC 5장). 프롬프트 < MIN_PROMPTS 이고 셸 < MIN_SHELL 이면 insufficient. */
export const MIN_PROMPTS = 30;
export const MIN_SHELL = 200;

/** "표본 적음" 배지 기준. 프롬프트가 이보다 적으면 lowSample 배지를 단다. */
export const LOW_SAMPLE_PROMPTS = 60;

/** |점수| < BORDERLINE 이면 경계형 (SPEC 6장 동점 처리). */
export const BORDERLINE = 5;

/** 기본 분석 기간 (일). */
export const DEFAULT_DAYS = 30;

/** 새벽 시간대 [시작, 끝) (SPEC 6장 재미용 통계 "새벽 2~5시"). */
export const NIGHT_HOURS: readonly [number, number] = [2, 6];

/** 샘플 프롬프트 (SPEC 7장). */
export const MAX_SAMPLES = 20;
export const SAMPLE_MAX_LENGTH = 120;
/** 선정 기준별로 최대 몇 개씩 뽑을지. 합이 MAX_SAMPLES를 넘으면 앞 기준부터 채운다. */
export const SAMPLES_PER_CRITERION = 4;

/** 20자 이하 명령형 프롬프트 (SPEC 6장 T/F). */
export const SHORT_IMPERATIVE_MAX_LENGTH = 20;

/** 가장 많이 반복한 프롬프트로 치려면 최소 몇 번 반복돼야 하는지. */
export const MIN_REPEAT_COUNT = 2;

export interface SignalSpec {
  axis: Axis;
  /** +1: 앞 글자(E/S/T/J) 방향, -1: 뒷 글자 방향 */
  sign: 1 | -1;
  baseline: number;
  scale: number;
  weight: number;
  /** 셸 명령 풀(셸 히스토리 + Claude Bash 툴)이 있어야 계산되는 시그널 */
  needsCommands?: boolean;
}

export const SIGNALS: Record<SignalKey, SignalSpec> = {
  // E / I
  avgTurns: { axis: "EI", sign: 1, baseline: 8, scale: 8, weight: 0.3 },
  questionRatio: { axis: "EI", sign: 1, baseline: 0.25, scale: 0.25, weight: 0.25 },
  avgPromptLength: { axis: "EI", sign: -1, baseline: 120, scale: 120, weight: 0.2 },
  interruptRatio: { axis: "EI", sign: 1, baseline: 0.1, scale: 0.1, weight: 0.25 },
  // S / N
  concreteRatio: { axis: "SN", sign: 1, baseline: 0.3, scale: 0.3, weight: 0.4 },
  abstractRatio: { axis: "SN", sign: -1, baseline: 0.15, scale: 0.15, weight: 0.35 },
  errorPasteRatio: { axis: "SN", sign: 1, baseline: 0.1, scale: 0.1, weight: 0.25 },
  // T / F
  emotionRatio: { axis: "TF", sign: -1, baseline: 0.1, scale: 0.1, weight: 0.5 },
  shortImperativeRatio: { axis: "TF", sign: 1, baseline: 0.3, scale: 0.3, weight: 0.5 },
  // J / P
  planRatio: { axis: "JP", sign: 1, baseline: 0.1, scale: 0.1, weight: 0.25 },
  testRatio: { axis: "JP", sign: 1, baseline: 0.05, scale: 0.05, weight: 0.2, needsCommands: true },
  forceRatio: {
    axis: "JP",
    sign: -1,
    baseline: 0.01,
    scale: 0.02,
    weight: 0.2,
    needsCommands: true,
  },
  redirectRatio: { axis: "JP", sign: -1, baseline: 0.1, scale: 0.1, weight: 0.15 },
  lowQualityCommitRatio: {
    axis: "JP",
    sign: -1,
    baseline: 0.2,
    scale: 0.2,
    weight: 0.2,
    needsCommands: true,
  },
};

/**
 * 배지 규칙. 위에서부터 조건을 검사해 만족하는 순서대로 최대 MAX_BADGES개.
 * lowSample은 표본 기준이라 stats가 아니라 analyze가 직접 판단한다.
 */
export interface BadgeRule {
  key: BadgeKey;
  test: (stats: Stats) => boolean;
}

export const BADGE_THRESHOLDS = {
  /** 새벽 활동 비율 (퍼센트) */
  nightOwl: 15,
  forcePusher: 3,
  rmrfSurvivor: 3,
  sudoBanger: 1,
  /** 감사 표현 횟수 */
  thankYouBot: 10,
  /** "다시" 횟수 */
  redoLoop: 10,
  /** 최장 세션 턴 수 */
  marathonSession: 30,
  /** 가장 짧은 프롬프트 글자 수 이하 */
  oneWordWonder: 3,
} as const;

export const BADGE_RULES: readonly BadgeRule[] = [
  { key: "forcePusher", test: (s) => s.forceCount >= BADGE_THRESHOLDS.forcePusher },
  { key: "rmrfSurvivor", test: (s) => s.rmrfCount >= BADGE_THRESHOLDS.rmrfSurvivor },
  { key: "nightOwl", test: (s) => s.nightRatio >= BADGE_THRESHOLDS.nightOwl },
  { key: "redoLoop", test: (s) => s.redoCount >= BADGE_THRESHOLDS.redoLoop },
  { key: "thankYouBot", test: (s) => s.thanksCount >= BADGE_THRESHOLDS.thankYouBot },
  { key: "marathonSession", test: (s) => s.longestSession >= BADGE_THRESHOLDS.marathonSession },
  { key: "sudoBanger", test: (s) => s.sudoBangCount >= BADGE_THRESHOLDS.sudoBanger },
  {
    key: "oneWordWonder",
    test: (s) =>
      s.shortestPrompt !== undefined &&
      [...s.shortestPrompt].length <= BADGE_THRESHOLDS.oneWordWonder,
  },
];
