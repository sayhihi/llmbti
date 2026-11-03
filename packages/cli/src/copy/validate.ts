/**
 * CopyJson 검증 (SPEC 8장 + skill/TONE.md). render가 쓰고, 라이트 모드 템플릿 결과도 같은 검사를 통과해야 한다.
 *
 * 실패하면 문제를 전부 모아 한국어 목록으로 돌려준다. 스킬은 그 목록을 보고 Claude가 다시 쓰게 한다.
 * 길이는 글자 수(코드 포인트) 기준이고 공백과 문장부호도 센다.
 */

import { COPY_LIMITS, MBTI_TYPES, isMbtiType, type CopyJson } from "@llmbit/core";

export type CopyValidation = { ok: true; copy: CopyJson } | { ok: false; problems: string[] };

/** TONE.md 금지 문자: 가운뎃점 계열과 줄표 계열. */
export const FORBIDDEN_CHARS: ReadonlyArray<{ char: string; name: string }> = [
  { char: "·", name: "가운뎃점(·)" },
  { char: "ㆍ", name: "가운뎃점(ㆍ)" },
  { char: "•", name: "불릿(•)" },
  { char: "—", name: "줄표(—)" },
  { char: "–", name: "줄표(–)" },
  { char: "―", name: "줄표(―)" },
];

export const ROAST_SENTENCES: readonly [number, number] = [2, 3];

export function charLength(s: string): number {
  return [...s].length;
}

/**
 * 문장 수. `.`, `!`, `?` 뒤에 공백이나 문자열 끝이 오는 자리를 센다. `2.1자` 같은 소수점은 안 센다.
 * 끝이 문장부호로 안 끝나면 마지막 조각도 한 문장으로 친다.
 */
export function countSentences(text: string): number {
  const t = text.trim();
  if (t === "") return 0;
  const enders = t.match(/[.!?]+(?=\s|$)/g)?.length ?? 0;
  return /[.!?]$/.test(t) ? enders : enders + 1;
}

export function hasDigit(s: string): boolean {
  return /\d/.test(s);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function validateCopy(value: unknown): CopyValidation {
  const problems: string[] = [];
  if (!isRecord(value)) {
    return { ok: false, problems: ["copy JSON이 객체가 아니다."] };
  }

  const str = (key: string, v: unknown, max: number, label: string): string | undefined => {
    if (typeof v !== "string") {
      problems.push(`${label}: 문자열이어야 한다 (${key}).`);
      return undefined;
    }
    if (v.trim() === "") {
      problems.push(`${label}: 비어 있다.`);
      return v;
    }
    const n = charLength(v);
    if (n > max) problems.push(`${label}: ${max}자 이하여야 한다. 지금 ${n}자.`);
    return v;
  };

  if (value.lang !== "ko" && value.lang !== "en") {
    problems.push(`lang: "ko" 또는 "en"이어야 한다.`);
  }

  str("nickname", value.nickname, COPY_LIMITS.nickname, "nickname");

  const roast = str("roast", value.roast, COPY_LIMITS.roast, "roast");
  if (roast !== undefined && roast.trim() !== "") {
    const n = countSentences(roast);
    const [lo, hi] = ROAST_SENTENCES;
    if (n < lo || n > hi) problems.push(`roast: ${lo}~${hi}문장이어야 한다. 지금 ${n}문장.`);
  }

  const evidence = value.evidence;
  if (!Array.isArray(evidence)) {
    problems.push("evidence: 배열이어야 한다.");
  } else {
    if (evidence.length !== COPY_LIMITS.evidenceCount) {
      problems.push(
        `evidence: 정확히 ${COPY_LIMITS.evidenceCount}개여야 한다. 지금 ${evidence.length}개.`,
      );
    }
    evidence.forEach((e: unknown, i: number) => {
      const label = `evidence[${i + 1}]`;
      const s = str(`evidence.${i}`, e, COPY_LIMITS.evidenceEach, label);
      if (s !== undefined && !hasDigit(s)) problems.push(`${label}: 숫자가 하나는 있어야 한다.`);
    });
  }

  str("commitMessage", value.commitMessage, COPY_LIMITS.commitMessage, "commitMessage");

  const pair = value.pairWith;
  if (!isRecord(pair)) {
    problems.push("pairWith: { type, reason } 객체여야 한다.");
  } else {
    if (!isMbtiType(pair.type)) {
      problems.push(`pairWith.type: 16개 유형 중 하나여야 한다 (${MBTI_TYPES.join(", ")}).`);
    }
    str("pairWith.reason", pair.reason, COPY_LIMITS.pairReason, "pairWith.reason");
  }

  for (const [field, text] of stringFields(value)) {
    for (const { char, name } of FORBIDDEN_CHARS) {
      if (text.includes(char)) problems.push(`${field}: ${name} 금지. 쉼표나 콜론으로 바꾼다.`);
    }
  }

  if (problems.length > 0) return { ok: false, problems };
  return { ok: true, copy: value as unknown as CopyJson };
}

/** 검증 대상 문자열 필드 [이름, 값]. 타입이 안 맞는 값은 건너뛴다. */
function stringFields(v: Record<string, unknown>): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const key of ["nickname", "roast", "commitMessage"] as const) {
    if (typeof v[key] === "string") out.push([key, v[key]]);
  }
  if (Array.isArray(v.evidence)) {
    v.evidence.forEach((e: unknown, i: number) => {
      if (typeof e === "string") out.push([`evidence[${i + 1}]`, e]);
    });
  }
  if (isRecord(v.pairWith) && typeof v.pairWith.reason === "string") {
    out.push(["pairWith.reason", v.pairWith.reason]);
  }
  return out;
}

/** 번호 매긴 한국어 목록. stderr용. */
export function formatProblems(problems: readonly string[]): string {
  return problems.map((p, i) => `${i + 1}. ${p}`).join("\n") + "\n";
}

/** 문구 전체를 redact에 한 번 더 통과시킨다 (SPEC 7장). */
export function mapCopyStrings(copy: CopyJson, fn: (s: string) => string): CopyJson {
  return {
    lang: copy.lang,
    nickname: fn(copy.nickname),
    roast: fn(copy.roast),
    evidence: copy.evidence.map(fn),
    commitMessage: fn(copy.commitMessage),
    pairWith: { type: copy.pairWith.type, reason: fn(copy.pairWith.reason) },
  };
}
