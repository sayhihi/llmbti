/**
 * 개발용 미리보기. 캐릭터를 현재 터미널에 찍는다. 배포 번들에는 들어가지 않는다.
 *
 *   pnpm --filter llmbti preview INTJ
 *   pnpm --filter llmbti preview ENFP --mode 256
 *   pnpm --filter llmbti preview ISTP --frame 1 --width 60
 *   pnpm --filter llmbti preview --all
 *
 * --mode truecolor|256|none   자동 판정 대신 강제
 * --frame N                   프레임 인덱스 (기본 0)
 * --width N                   레이아웃 폭 (기본 터미널 폭, 없으면 80)
 * --all                       그려진 유형 전부
 */

import {
  DRAWN_TYPES,
  TEMPERAMENT_OF,
  TYPE_META,
  getCharacter,
  isMbtiType,
  type CharacterId,
  type MbtiType,
  type Scores,
} from "@llmbti/core";

import {
  axisBars,
  detectColorMode,
  isColorMode,
  layoutResult,
  renderCharacterAnsi,
} from "../terminal";

interface Args {
  ids: CharacterId[];
  mode?: string;
  frame: number;
  width: number;
  all: boolean;
}

function parse(argv: string[]): Args {
  const args: Args = { ids: [], frame: 0, width: process.stdout.columns || 80, all: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--mode") args.mode = argv[++i];
    else if (a.startsWith("--mode=")) args.mode = a.slice(7);
    else if (a === "--frame") args.frame = Number(argv[++i]);
    else if (a === "--width") args.width = Number(argv[++i]);
    else if (a === "--all") args.all = true;
    else if (a === "--no-color")
      continue; // detectColorMode가 process.argv에서 읽는다
    else if (a.startsWith("-")) die(`알 수 없는 옵션: ${a}`);
    else {
      const id = a.toUpperCase();
      if (id === "_BASE") args.ids.push("_base");
      else if (isMbtiType(id)) args.ids.push(id);
      else die(`유형이 아님: ${a}`);
    }
  }
  if (args.all) args.ids = [...DRAWN_TYPES];
  if (args.ids.length === 0) args.ids = ["INTJ"];
  return args;
}

function die(msg: string): never {
  process.stderr.write(`preview: ${msg}\n`);
  process.exit(2);
}

/** 미리보기용 가짜 점수. 유형 글자 쪽으로 기울인다. */
function sampleScores(type: MbtiType): Scores {
  return {
    EI: type[0] === "E" ? 62 : -58,
    SN: type[1] === "S" ? 41 : -73,
    TF: type[2] === "T" ? 85 : -22,
    JP: type[3] === "J" ? 30 : -66,
  };
}

function rightColumn(id: CharacterId): string[] {
  if (id === "_base") return ["_base", "Claude 마스코트 베이스 (몸 색 SJ 테라코타)"];
  const meta = TYPE_META[id];
  return [
    `${id}  ${meta.nickname}`,
    `${meta.tagline}  (${TEMPERAMENT_OF(id)})`,
    "",
    ...axisBars(sampleScores(id)),
    "",
    "evidence 1: 프롬프트 123개 중 두 글자 41개",
    "evidence 2: --force 12번",
    "evidence 3: 새벽 활동 40%",
  ];
}

function main(): number {
  const args = parse(process.argv.slice(2));

  let mode = detectColorMode();
  if (args.mode !== undefined) {
    if (!isColorMode(args.mode)) die(`--mode는 truecolor|256|none 중 하나: ${args.mode}`);
    mode = args.mode;
  }
  process.stderr.write(
    `preview: mode=${mode} width=${args.width} frame=${args.frame} (COLORTERM=${process.env.COLORTERM ?? ""} TERM=${process.env.TERM ?? ""} NO_COLOR=${process.env.NO_COLOR ?? ""} tty=${Boolean(process.stdout.isTTY)})\n`,
  );

  let status = 0;
  for (const id of args.ids) {
    const character = getCharacter(id);
    if (!character) {
      process.stderr.write(
        `preview: ${id}는 아직 안 그렸다. 그려진 유형: ${DRAWN_TYPES.join(", ")}\n`,
      );
      status = 1;
      continue;
    }
    const characterLines = renderCharacterAnsi(character, { mode, frame: args.frame });
    if (characterLines.length === 0) {
      process.stderr.write(`preview: ${id} 캐릭터 생략 (mode=none)\n`);
    }
    const lines = layoutResult({ characterLines, rightLines: rightColumn(id), width: args.width });
    process.stdout.write(lines.join("\n") + "\n\n");
  }
  return status;
}

process.exitCode = main();
