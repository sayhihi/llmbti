/**
 * 샘플 프롬프트 선정 (SPEC 7장). 최대 MAX_SAMPLES개, 각 SAMPLE_MAX_LENGTH자, redact 통과.
 *
 * 기준 순서: 가장 짧은 것 → 가장 많이 반복된 것 → 새벽 시간대 → 방향 전환 키워드 → 감정 표현.
 * 기준마다 SAMPLES_PER_CRITERION개씩 먼저 채우고, 자리가 남으면 같은 순서로 한 바퀴 더 돈다.
 * 모든 정렬에 동점 처리(텍스트 사전순)를 넣어서 결정적이다.
 */

import type { ClassifiedPrompt } from "./metrics";
import { redactAndTrim } from "./redact";
import type { RedactOptions } from "./redact";
import { MAX_SAMPLES, SAMPLES_PER_CRITERION, SAMPLE_MAX_LENGTH } from "./scoring.constants";

type Criterion = (classified: ClassifiedPrompt[]) => string[];

const byText = (a: string, b: string) => a.localeCompare(b);

const shortest: Criterion = (cs) =>
  [...cs]
    .filter((c) => c.flags.length > 0)
    .sort((a, b) => a.flags.length - b.flags.length || byText(a.prompt.text, b.prompt.text))
    .map((c) => c.prompt.text);

const mostRepeated: Criterion = (cs) => {
  const counts = new Map<string, number>();
  for (const c of cs) counts.set(c.prompt.text, (counts.get(c.prompt.text) ?? 0) + 1);
  return [...counts.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].length - b[0].length || byText(a[0], b[0]))
    .map(([t]) => t);
};

const lateNight: Criterion = (cs) =>
  [...cs]
    .filter((c) => c.night)
    .sort((a, b) => a.flags.length - b.flags.length || byText(a.prompt.text, b.prompt.text))
    .map((c) => c.prompt.text);

const redirect: Criterion = (cs) =>
  [...cs]
    .filter((c) => c.flags.redirect || c.flags.interrupt)
    .sort((a, b) => a.flags.length - b.flags.length || byText(a.prompt.text, b.prompt.text))
    .map((c) => c.prompt.text);

const emotion: Criterion = (cs) =>
  [...cs]
    .filter((c) => c.flags.emotion)
    .sort((a, b) => a.flags.length - b.flags.length || byText(a.prompt.text, b.prompt.text))
    .map((c) => c.prompt.text);

const CRITERIA: readonly Criterion[] = [shortest, mostRepeated, lateNight, redirect, emotion];

export function pickSamples(
  classified: ClassifiedPrompt[],
  redactOpts: RedactOptions = {},
): string[] {
  const lists = CRITERIA.map((c) => c(classified));
  const seen = new Set<string>();
  const out: string[] = [];
  const take = (text: string): boolean => {
    const cleaned = redactAndTrim(text, SAMPLE_MAX_LENGTH, redactOpts);
    if (cleaned === "" || seen.has(cleaned)) return false;
    seen.add(cleaned);
    out.push(cleaned);
    return true;
  };
  // 1차: 기준별 SAMPLES_PER_CRITERION개
  for (const list of lists) {
    let taken = 0;
    for (const text of list) {
      if (out.length >= MAX_SAMPLES || taken >= SAMPLES_PER_CRITERION) break;
      if (take(text)) taken++;
    }
  }
  // 2차: 남은 자리를 같은 순서로 채운다
  for (const list of lists) {
    for (const text of list) {
      if (out.length >= MAX_SAMPLES) return out;
      take(text);
    }
  }
  return out;
}
