#!/usr/bin/env node
// 샘플 결과 URL 3개를 찍는다. 웹 결과 페이지를 손으로 확인할 때 쓴다.
//
//   pnpm --filter @llmbti/core build   # 먼저 core dist 를 만든다
//   node scripts/sample-url.mjs [--base http://localhost:4173]
//
// 샘플: INTJ (claude 모드), ENFP (lite 모드), ISTP (JP 축 경계형)

import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const dist = resolve(root, "packages/core/dist/index.js");

const args = process.argv.slice(2);
let base = "http://localhost:4173";
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--base") base = args[++i] ?? base;
}

if (!existsSync(dist)) {
  console.error("packages/core/dist 가 없다. 먼저 실행: pnpm --filter @llmbti/core build");
  process.exit(2);
}

const core = await import(pathToFileURL(dist).href);
const { buildResultUrl, URL_WARN_LENGTH } = core;

/** @type {import("../packages/core/src/types").ResultPayload[]} */
const samples = [
  {
    v: 1,
    type: "INTJ",
    scores: { EI: -62, SN: -48, TF: 55, JP: 71 },
    badges: ["nightOwl", "marathonSession"],
    stats: { nightRatio: 18, longestSession: 41 },
    why: { EI: [["avgPromptLength", 212], ["questionRatio", 0.08]], SN: [["abstractRatio", 0.31]], TF: [["shortImperativeRatio", 0.44]], JP: [["planRatio", 0.27], ["testRatio", 0.12]] },
    copy: {
      lang: "ko",
      nickname: "리베이스 장인",
      roast:
        "rebase -i 47번, merge 0번. 커밋 트리가 한 줄이 아니면 잠이 안 오는 사람이다. 고마워 대신 다음 작업을 바로 붙이는 걸 Claude도 눈치챘다.",
      evidence: [
        "rebase -i 47번, merge 커밋 0개",
        "프롬프트 평균 길이 184자",
        "계획 신호 비율 31%",
      ],
      commitMessage: "refactor: squash 23 commits into one truth",
      pairWith: { type: "ENFP", reason: "사방으로 뻗은 브랜치를 한 줄로 정리해 줌" },
    },
    mode: "claude",
    periodDays: 30,
    sampleSize: { prompts: 212, shell: 1380 },
  },
  {
    v: 1,
    type: "ENFP",
    scores: { EI: 58, SN: -44, TF: -37, JP: -80 },
    badges: ["redoLoop", "thankYouBot", "forcePusher", "someFutureBadge"],
    stats: { redoCount: 38, thanksCount: 27, forceCount: 12 },
    copy: {
      lang: "ko",
      nickname: "브랜치 방랑자",
      roast:
        "다시 38번. 틀린 게 아니라 더 재밌는 길이 보여서 바꾼 거다. 브랜치는 늘었는데 main은 지난달 그대로다.",
      evidence: ['"다시" 38번', "--force push 12번", "세션당 평균 14턴"],
      commitMessage: "feat: started 3 things, finished 0",
      pairWith: { type: "INTJ", reason: "계획 없이 뻗은 브랜치를 누가 합쳐 줘야 함" },
    },
    mode: "lite",
    periodDays: 30,
    sampleSize: { prompts: 0, shell: 940 },
  },
  {
    v: 1,
    type: "ISTP",
    scores: { EI: -40, SN: 35, TF: 66, JP: -3 },
    badges: ["oneWordWonder"],
    stats: {},
    copy: {
      lang: "ko",
      nickname: "고쳐 장인",
      roast:
        "프롬프트 평균 2.1자. 고쳐, 다시, 해줘로 한 달을 버텼다. 에러 로그는 붙이는데 설명은 한 번도 안 붙였다.",
      evidence: ["프롬프트 평균 길이 2.1자", '"고쳐" 41번', "20자 이하 명령형 프롬프트 73%"],
      commitMessage: "fix",
      pairWith: { type: "ENFJ", reason: "왜 고쳤는지 대신 설명해 줌" },
    },
    mode: "claude",
    periodDays: 30,
    sampleSize: { prompts: 96, shell: 610 },
  },
];

for (const payload of samples) {
  const url = await buildResultUrl(base, payload);
  const warn = url.length > URL_WARN_LENGTH ? `  (경고: ${URL_WARN_LENGTH}자 초과)` : "";
  console.log(`# ${payload.type} ${payload.mode}  ${url.length}자${warn}`);
  console.log(url);
  console.log();
}
