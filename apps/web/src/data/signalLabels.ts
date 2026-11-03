import type { SignalKey } from "@llmbti/core";

/** 축 판정 근거 한 줄. {v} 자리에 값. ratio 면 0..1 을 퍼센트 정수로. */
export const SIGNAL_LABELS: Record<SignalKey, { text: string; ratio: boolean; digits?: number }> = {
  avgTurns: { text: "세션당 평균 {v}턴", ratio: false, digits: 1 },
  questionRatio: { text: "물음표로 끝난 프롬프트 {v}%", ratio: true },
  avgPromptLength: { text: "프롬프트 평균 {v}자", ratio: false },
  interruptRatio: { text: "잠깐, 아니 같은 끼어들기 {v}%", ratio: true },
  concreteRatio: { text: "경로나 코드가 들어간 프롬프트 {v}%", ratio: true },
  abstractRatio: { text: "구조, 설계 같은 추상 단어 {v}%", ratio: true },
  errorPasteRatio: { text: "에러 로그 붙여넣기 {v}%", ratio: true },
  emotionRatio: { text: "고마워, ㅋㅋ 같은 감정 표현 {v}%", ratio: true },
  shortImperativeRatio: { text: "20자 이하 명령형 {v}%", ratio: true },
  planRatio: { text: "계획, 단계 같은 계획 신호 {v}%", ratio: true },
  testRatio: { text: "테스트 실행 명령 {v}%", ratio: true },
  forceRatio: { text: "--force, rm -rf 같은 명령 {v}%", ratio: true },
  redirectRatio: { text: "다시, 취소 같은 방향 전환 {v}%", ratio: true },
  lowQualityCommitRatio: { text: "fix, wip 같은 커밋 메시지 {v}%", ratio: true },
};

export function signalLine(key: string, value: number): string {
  const meta = (SIGNAL_LABELS as Record<string, { text: string; ratio: boolean; digits?: number } | undefined>)[key];
  if (!meta) return `${key} ${value}`;
  const shown = meta.ratio
    ? String(Math.round(value * 100))
    : meta.digits
      ? value.toFixed(meta.digits)
      : String(Math.round(value));
  return meta.text.replace("{v}", shown);
}
