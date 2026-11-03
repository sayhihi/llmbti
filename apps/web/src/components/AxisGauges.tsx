import { AXES } from "@llmbti/core";
import type { Axis, ResultPayload, Scores } from "@llmbti/core";

import { signalLine } from "../data/signalLabels";

/** |점수| < 5 이면 경계형 (SPEC 6장 동점 처리) */
export const BORDERLINE_THRESHOLD = 5;

const AXIS_LABEL: Record<Axis, { left: string; right: string; leftKo: string; rightKo: string }> = {
  EI: { left: "E", right: "I", leftKo: "대화형", rightKo: "독백형" },
  SN: { left: "S", right: "N", leftKo: "구체", rightKo: "추상" },
  TF: { left: "T", right: "F", leftKo: "건조", rightKo: "다정" },
  JP: { left: "J", right: "P", leftKo: "계획형", rightKo: "즉흥형" },
};

export function isBorderline(score: number): boolean {
  return Math.abs(score) < BORDERLINE_THRESHOLD;
}

interface Props {
  scores: Scores;
  /** 랜딩 카드처럼 작게 */
  compact?: boolean;
  /** 축별 판정 근거 (payload.why). compact 가 아닐 때만 보여 준다 */
  why?: ResultPayload["why"];
}

/**
 * 4축 게이지. 가운데가 0, 왼쪽 끝이 +100(E, S, T, J), 오른쪽 끝이 -100.
 * 양수면 앞 글자 쪽으로 채운다. 경계형이면 마커에 점선과 "경계" 표시.
 */
export function AxisGauges({ scores, compact = false, why }: Props) {
  return (
    <div className={compact ? "gauges gauges-compact" : "gauges"}>
      {AXES.map((axis) => (
        <Gauge
          key={axis}
          axis={axis}
          score={clamp(scores[axis])}
          compact={compact}
          reasons={compact ? [] : (why?.[axis] ?? [])}
        />
      ))}
    </div>
  );
}

function Gauge({
  axis,
  score,
  compact,
  reasons,
}: {
  axis: Axis;
  score: number;
  compact: boolean;
  reasons: [string, number][];
}) {
  const label = AXIS_LABEL[axis];
  const border = isBorderline(score);
  const leftWins = score >= 0;
  // 0 -> 50%, +100 -> 0%, -100 -> 100%
  const pos = 50 - score / 2;
  const fillStyle = leftWins
    ? { left: `${pos}%`, width: `${50 - pos}%` }
    : { left: "50%", width: `${pos - 50}%` };
  const winner = leftWins ? label.left : label.right;
  const title = border
    ? `${label.left}/${label.right} 경계형 (${score})`
    : `${winner} ${Math.abs(score)}`;

  return (
    <div className={border ? "gauge gauge-borderline" : "gauge"} title={title}>
      <div className={leftWins ? "gauge-end win" : "gauge-end"}>
        <span className="px gauge-letter">{label.left}</span>
        {!compact && <span className="gauge-ko">{label.leftKo}</span>}
      </div>
      <div
        className="gauge-track"
        role="meter"
        aria-label={`${label.left} ${label.right} 축`}
        aria-valuemin={-100}
        aria-valuemax={100}
        aria-valuenow={score}
        aria-valuetext={title}
      >
        <span className="gauge-center" aria-hidden="true" />
        <span className="gauge-fill" style={fillStyle} aria-hidden="true" />
        <span className="gauge-marker" style={{ left: `${pos}%` }} aria-hidden="true" />
        {!compact && (
          <span className="gauge-value" style={{ left: `${pos}%` }} aria-hidden="true">
            {border ? "경계" : Math.abs(score)}
          </span>
        )}
      </div>
      <div className={!leftWins ? "gauge-end right win" : "gauge-end right"}>
        <span className="px gauge-letter">{label.right}</span>
        {!compact && <span className="gauge-ko">{label.rightKo}</span>}
      </div>
      {reasons.length > 0 && (
        <p className="gauge-why dim small">
          {reasons.map(([k, v]) => signalLine(k, v)).join(", ")}
        </p>
      )}
    </div>
  );
}

function clamp(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(-100, Math.min(100, Math.round(n)));
}
