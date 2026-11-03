/**
 * 랜딩의 예시 결과 3개. 실제 분석이 아니라 typeMeta + 가짜 점수다.
 * 샘플 캐릭터가 있는 INTJ, ENFP, ISTP 를 쓴다 (M3 샘플 3종).
 */

import type { MbtiType, Scores } from "@llmbit/core";

export interface SampleResult {
  type: MbtiType;
  scores: Scores;
  evidence: string;
}

export const SAMPLE_RESULTS: SampleResult[] = [
  {
    type: "ENFP",
    scores: { EI: 58, SN: -44, TF: -37, JP: -80 },
    evidence: "브랜치 23개, 머지 0개",
  },
  {
    type: "INTJ",
    scores: { EI: -62, SN: -48, TF: 55, JP: 71 },
    evidence: "rebase -i 47번, merge 0번",
  },
  {
    type: "ISTP",
    scores: { EI: -40, SN: 35, TF: 66, JP: -22 },
    evidence: "프롬프트 평균 길이 2.1자",
  },
];
