/**
 * 4축 점수 + 유형 판정 (SPEC 6장). 결정적이다: 같은 Signals면 같은 결과.
 *
 * - 축 점수 = round(100 * Σ(weight_i * sign_i * clamp((x_i - baseline_i) / scale_i, -1, 1)))
 *   가중치는 그 축에서 값이 있는 시그널끼리 합이 1이 되게 재정규화한다 (셸 히스토리 없을 때 등).
 * - 축에 값이 있는 시그널이 하나도 없으면 0점.
 * - |점수| < BORDERLINE 이면 경계형. 판정은 부호대로, 0이면 앞 글자.
 */

import { AXES, isMbtiType } from "@llmbti/core";
import type { Axis, MbtiType, Scores, SignalKey, Signals } from "@llmbti/core";
import { BORDERLINE, SIGNALS } from "./scoring.constants";

export interface ScoringResult {
  scores: Scores;
  type: MbtiType;
  borderline: Axis[];
}

const FRONT: Record<Axis, string> = { EI: "E", SN: "S", TF: "T", JP: "J" };
const BACK: Record<Axis, string> = { EI: "I", SN: "N", TF: "F", JP: "P" };

export function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export function normalizeSignal(key: SignalKey, value: number): number {
  const spec = SIGNALS[key];
  return clamp((value - spec.baseline) / spec.scale, -1, 1);
}

/** 한 축의 점수. 값이 없는 시그널은 빼고 가중치를 재정규화한다. */
export function scoreAxis(axis: Axis, signals: Signals): number {
  let weightSum = 0;
  let acc = 0;
  for (const key of Object.keys(SIGNALS) as SignalKey[]) {
    const spec = SIGNALS[key];
    if (spec.axis !== axis) continue;
    const value = signals[key];
    if (value === undefined || !Number.isFinite(value)) continue;
    weightSum += spec.weight;
    acc += spec.weight * spec.sign * normalizeSignal(key, value);
  }
  if (weightSum === 0) return 0;
  const score = Math.round((100 * acc) / weightSum);
  // -0 방지
  return score === 0 ? 0 : clamp(score, -100, 100);
}

export function letterOf(axis: Axis, score: number): string {
  return score >= 0 ? FRONT[axis] : BACK[axis];
}

export function typeOf(scores: Scores): MbtiType {
  const letters = AXES.map((axis) => letterOf(axis, scores[axis])).join("");
  if (!isMbtiType(letters)) throw new Error(`invalid type computed: ${letters}`);
  return letters;
}

export function score(signals: Signals): ScoringResult {
  const scores: Scores = {
    EI: scoreAxis("EI", signals),
    SN: scoreAxis("SN", signals),
    TF: scoreAxis("TF", signals),
    JP: scoreAxis("JP", signals),
  };
  const borderline = AXES.filter((axis) => Math.abs(scores[axis]) < BORDERLINE);
  return { scores, type: typeOf(scores), borderline };
}

/** 경계형 축을 `?`로 표시한 문자열. 예: `EN?P` */
export function displayType(result: ScoringResult): string {
  return AXES.map((axis) =>
    result.borderline.includes(axis) ? "?" : letterOf(axis, result.scores[axis]),
  ).join("");
}
