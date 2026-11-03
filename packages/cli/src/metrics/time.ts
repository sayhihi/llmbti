/**
 * 시간대 통계. 시간은 로컬 시간 기준이고, 테스트에서는 tzOffsetMinutes로 고정할 수 있다.
 */

import { NIGHT_HOURS } from "../scoring.constants";

export interface HourStats {
  /** 0..23 활동 수 */
  histogram: number[];
  /** 가장 활발한 시간대. 활동이 없으면 undefined. 동점이면 이른 시간 */
  peakHour?: number;
  /** 새벽 비율 0..1 */
  nightRatio: number;
  total: number;
}

/** ts(epoch ms)의 시(0..23). tzOffsetMinutes는 UTC 기준 분 단위 오프셋 (KST = +540). */
export function hourOf(ts: number, tzOffsetMinutes?: number): number {
  if (tzOffsetMinutes === undefined) return new Date(ts).getHours();
  const shifted = new Date(ts + tzOffsetMinutes * 60_000);
  return shifted.getUTCHours();
}

export function isNightHour(hour: number): boolean {
  return hour >= NIGHT_HOURS[0] && hour < NIGHT_HOURS[1];
}

export function hourStats(timestamps: number[], tzOffsetMinutes?: number): HourStats {
  const histogram = new Array<number>(24).fill(0);
  let night = 0;
  for (const ts of timestamps) {
    const h = hourOf(ts, tzOffsetMinutes);
    histogram[h] = (histogram[h] ?? 0) + 1;
    if (isNightHour(h)) night++;
  }
  const total = timestamps.length;
  let peakHour: number | undefined;
  let best = 0;
  for (let h = 0; h < 24; h++) {
    const c = histogram[h] ?? 0;
    if (c > best) {
      best = c;
      peakHour = h;
    }
  }
  return { histogram, peakHour, nightRatio: total === 0 ? 0 : night / total, total };
}
