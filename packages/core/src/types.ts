/**
 * llmbti 공유 타입.
 *
 * 이 파일은 M0 초안이다. 분석 엔진(M1)과 웹(M2) 에이전트가 필요한 필드를 덧붙인다.
 * 단, `ResultPayload`와 `CopyJson`은 SPEC 8장·9장과 1:1이므로 바꾸려면 SPEC을 먼저 고친다.
 */

export const MBTI_TYPES = [
  "INTJ",
  "INTP",
  "ENTJ",
  "ENTP",
  "INFJ",
  "INFP",
  "ENFJ",
  "ENFP",
  "ISTJ",
  "ISFJ",
  "ESTJ",
  "ESFJ",
  "ISTP",
  "ISFP",
  "ESTP",
  "ESFP",
] as const;

export type MbtiType = (typeof MBTI_TYPES)[number];

export function isMbtiType(value: unknown): value is MbtiType {
  return typeof value === "string" && (MBTI_TYPES as readonly string[]).includes(value);
}

/** 4축 키. 양수면 앞 글자(E, S, T, J). */
export type Axis = "EI" | "SN" | "TF" | "JP";

export const AXES: readonly Axis[] = ["EI", "SN", "TF", "JP"];

/** 축 점수. 각 -100..+100 정수. */
export type Scores = Record<Axis, number>;

/** 기질 4그룹. 캐릭터 몸 색과 연결된다 (SPEC 10장). */
export type Temperament = "NT" | "NF" | "SJ" | "SP";

export const TEMPERAMENTS: readonly Temperament[] = ["NT", "NF", "SJ", "SP"];

/** 유형 → 기질. N이면 셋째 글자(T/F), S면 넷째 글자(J/P)로 가른다. */
export function TEMPERAMENT_OF(type: MbtiType): Temperament {
  if (type[1] === "N") return type[2] === "T" ? "NT" : "NF";
  return type[3] === "J" ? "SJ" : "SP";
}

/** 기질별 몸 색 팔레트 인덱스 [기본, 그림자] (palette.json). */
export const TEMPERAMENT_PALETTE: Readonly<Record<Temperament, readonly [number, number]>> = {
  SJ: [5, 6],
  NT: [7, 8],
  NF: [9, 10],
  SP: [11, 12],
};

/** SPEC 8장 CopyJson. Claude 또는 라이트 모드 템플릿이 채운다. */
export type CopyJson = {
  lang: "ko" | "en";
  /** 한 줄 별명, ≤ 20자 */
  nickname: string;
  /** 디스 본문, 2~3문장, ≤ 200자 */
  roast: string;
  /** 정확히 3개, 각 ≤ 60자, 반드시 실제 숫자 포함 */
  evidence: string[];
  /** "오늘의 커밋 메시지", ≤ 50자 */
  commitMessage: string;
  /** 페어 프로그래밍 궁합. reason ≤ 40자 */
  pairWith: { type: MbtiType; reason: string };
};

/** CopyJson 길이 제한 (SPEC 8장). render 검증과 웹 표시가 같이 쓴다. */
export const COPY_LIMITS = {
  nickname: 20,
  roast: 200,
  evidenceCount: 3,
  evidenceEach: 60,
  commitMessage: 50,
  pairReason: 40,
} as const;

export type ResultMode = "claude" | "lite";

/** SPEC 9장 ResultPayload. URL hash에 실려 가는 유일한 데이터. */
export type ResultPayload = {
  v: 1;
  type: MbtiType;
  scores: Scores;
  /** 통계 배지 키, 최대 6개. 예: "nightOwl", "forcePusher" */
  badges: string[];
  /** 배지 표시에 필요한 숫자만 */
  stats: Record<string, number>;
  copy: CopyJson;
  mode: ResultMode;
  periodDays: number;
  sampleSize: { prompts: number; shell: number };
};

export const PAYLOAD_VERSION = 1 as const;
export const MAX_BADGES = 6;

/**
 * analyze가 집계하는 재미용 통계 (SPEC 6장 "재미용 통계").
 * 축 점수 계산에는 쓰지 않고 문구와 배지에만 쓴다.
 *
 * 키 이름은 `cli/src/templates/evidence.ko.json`의 슬롯 키와 1:1이다
 * (forceCount, rmrfCount, nightRatio, redoCount, thanksCount, topCommand, shortestPrompt,
 * avgTurns, longestSession, promptCount, shellCount). 바꾸려면 템플릿도 같이 바꾼다.
 * 모든 필드는 집계값이며, 문자열 필드(shortestPrompt, topCommand, mostRepeatedPrompt)는 redact를 통과한 값이다.
 */
export interface Stats {
  /** 분석 기간 안의 사람 프롬프트 수 */
  promptCount: number;
  /** 분석 기간 안의 셸 명령 수 (zsh + bash) */
  shellCount: number;
  /** Claude 세션 수 (사람 프롬프트가 1개 이상인 세션만) */
  sessionCount: number;
  /** 세션당 평균 사람 턴 수 (소수 1자리) */
  avgTurns: number;
  /** 최장 세션 길이 (사람 턴 수) */
  longestSession: number;
  /** 가장 활발한 시간대 (0..23). 활동이 없으면 생략 */
  peakHour?: number;
  /** 새벽 2~5시 활동 비율, 퍼센트 정수 0..100 */
  nightRatio: number;
  /** `--force`/`-f` push, `reset --hard` 류 강제 명령 횟수 (셸 + Claude Bash 툴) */
  forceCount: number;
  /** `rm -rf` 횟수 */
  rmrfCount: number;
  /** `sudo !!` 횟수 */
  sudoBangCount: number;
  /** 많이 친 셸 명령 1위 (인자 제외). 셸 히스토리가 없으면 생략 */
  topCommand?: string;
  /** 많이 친 셸 명령 top 5 (인자 제외) */
  topCommands: Array<{ command: string; count: number }>;
  /** 가장 짧은 프롬프트 (redact 통과, ≤ 120자) */
  shortestPrompt?: string;
  /** 가장 많이 반복한 프롬프트 (redact 통과, ≤ 120자). 2회 이상 반복된 게 없으면 생략 */
  mostRepeatedPrompt?: { text: string; count: number };
  /** "다시"류 방향 전환 프롬프트 횟수 */
  redoCount: number;
  /** "고마워"류 감사 표현 프롬프트 횟수 */
  thanksCount: number;
  /** 인터럽트 횟수 (중단 이벤트 + "잠깐/아니/stop"으로 시작하는 프롬프트) */
  interruptCount: number;
  /** 가장 많이 쓴 Claude 툴. 세션 로그가 없으면 생략 */
  topTool?: { name: string; count: number };
  /** 파싱 중 건너뛴 깨진 줄 수 (모든 소스 합) */
  skippedLines: number;
}

/**
 * 4축 점수의 재료가 되는 정규화 전 시그널 (SPEC 6장 표). 비율은 0..1.
 * 셸 히스토리나 세션 로그가 없어서 계산할 수 없는 시그널은 undefined로 두고, scoring이 가중치를 재정규화한다.
 */
export interface Signals {
  avgTurns?: number;
  questionRatio?: number;
  avgPromptLength?: number;
  interruptRatio?: number;
  concreteRatio?: number;
  abstractRatio?: number;
  errorPasteRatio?: number;
  emotionRatio?: number;
  shortImperativeRatio?: number;
  planRatio?: number;
  testRatio?: number;
  forceRatio?: number;
  redirectRatio?: number;
  lowQualityCommitRatio?: number;
}

export type SignalKey = keyof Signals;

/** 통계 배지 키 (SPEC 9장 `badges`). 선정 기준은 cli/src/scoring.constants.ts BADGE_RULES. */
export const BADGE_KEYS = [
  "nightOwl",
  "forcePusher",
  "rmrfSurvivor",
  "sudoBanger",
  "thankYouBot",
  "redoLoop",
  "marathonSession",
  "oneWordWonder",
  "lowSample",
] as const;

export type BadgeKey = (typeof BADGE_KEYS)[number];

/** 어떤 데이터 소스를 읽었는지. 셸 히스토리가 없으면 해당 시그널 가중치를 재정규화한다. */
export interface SourceAvailability {
  claudeHistory: boolean;
  claudeProjects: boolean;
  zsh: boolean;
  bash: boolean;
}

/**
 * `llmbti analyze --json`의 출력. 스킬과 render가 읽는다.
 * `insufficient: true`여도 scores/type은 채워져 있지만 신뢰하지 않는다 (SPEC 5장 최소 표본).
 */
export interface AnalysisOutput {
  v: 1;
  /** 최소 표본 미달이면 true. 이때 type/scores는 신뢰하지 않는다. */
  insufficient: boolean;
  periodDays: number;
  sampleSize: { prompts: number; shell: number };
  sources: SourceAvailability;
  scores: Scores;
  type: MbtiType;
  /** |점수| < 5 인 경계형 축 */
  borderline: Axis[];
  badges: BadgeKey[];
  stats: Stats;
  /** 점수 계산에 들어간 시그널 (디버그·문구용). 계산 불가한 건 생략 */
  signals: Signals;
  /** redact 통과한 샘플 프롬프트, 최대 20개, 각 ≤ 120자 */
  samples: string[];
}
