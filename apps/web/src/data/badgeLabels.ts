/**
 * 통계 배지 키 -> 한글 라벨. 배지 라벨은 이 파일 한 곳에만 둔다.
 *
 * 분석 엔진(M1)이 내보내는 배지 키가 아직 확정되지 않아서 SPEC 6장 "재미용 통계"를 기준으로 초안을 잡았다.
 * 모르는 키는 raw 그대로 보여 준다. 그래야 엔진 쪽에서 키를 추가해도 페이지가 깨지지 않는다.
 *
 * TODO(decision): 배지 키 목록의 소유자는 분석 엔진이다. 엔진이 키를 확정하면 이 표를 맞춘다.
 */

export interface BadgeLabel {
  /** 칩에 보이는 이름 */
  label: string;
  /** payload.stats 에서 같이 보여 줄 숫자 키 */
  stat?: string;
  /** 숫자 뒤에 붙는 단위. 예: "번", "%" */
  unit?: string;
  /** 0..1 비율이면 100을 곱해서 % 로 */
  ratio?: boolean;
}

export const BADGE_LABELS: Record<string, BadgeLabel> = {
  nightOwl: { label: "새벽 코더", stat: "lateNightRatio", unit: "%", ratio: true },
  earlyBird: { label: "아침형 커밋", stat: "peakHour", unit: "시" },
  forcePusher: { label: "--force 장인", stat: "forceCount", unit: "번" },
  rmRfer: { label: "rm -rf 단골", stat: "rmRfCount", unit: "번" },
  sudoBanger: { label: "sudo !! 애호가", stat: "sudoBangCount", unit: "번" },
  againAgain: { label: "다시 다시", stat: "againCount", unit: "번" },
  politeOne: { label: "고마워 담당", stat: "thanksCount", unit: "번" },
  marathoner: { label: "세션 마라토너", stat: "longestSessionTurns", unit: "턴" },
  shortPrompter: { label: "두 글자 프롬프트" },
  longPrompter: { label: "논문형 프롬프트" },
  interrupter: { label: "잠깐만 전문" },
  questioner: { label: "물음표 수집가" },
  errorPaster: { label: "에러 로그 복붙러" },
  pathPointer: { label: "경로와 라인 번호 지정" },
  refactorer: { label: "리팩터 중독" },
  planner: { label: "계획부터" },
  testRunner: { label: "테스트는 돌림" },
  lowQualityCommitter: { label: "커밋 메시지 fix" },
  pivoter: { label: "아니 그게 아니라" },
  emojiUser: { label: "이모지 리액션" },
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
  const meta = BADGE_LABELS[key];
  if (!meta) return { key, label: key, value: null, known: false };
  let value: string | null = null;
  if (meta.stat !== undefined) {
    const n = stats[meta.stat];
    if (typeof n === "number" && Number.isFinite(n)) {
      const shown = meta.ratio ? Math.round(n * 100) : Math.round(n);
      value = `${shown}${meta.unit ?? ""}`;
    }
  }
  return { key, label: meta.label, value, known: true };
}

export function badgeChips(keys: string[], stats?: Record<string, number>): BadgeChip[] {
  return keys.map((k) => badgeChip(k, stats));
}
