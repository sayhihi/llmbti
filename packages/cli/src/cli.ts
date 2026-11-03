/**
 * llmbit CLI 본체. index.ts가 process.argv로 main을 부른다.
 * 테스트는 io를 주입해서 stdout/stderr를 잡는다.
 * analyze는 M1에서 구현. render(M3), install/run(M4)은 아직 스텁이다.
 */

import { URL_WARN_LENGTH } from "@llmbit/core";
import { analyze, formatAnalysis } from "./commands/analyze";

const COMMANDS = ["run", "install", "analyze", "render"] as const;
type Command = (typeof COMMANDS)[number];

const USAGE = `llmbit - LLM에게 일을 시키는 패턴으로 보는 개발자 MBTI

사용법:
  llmbit                       라이트 모드: analyze -> 템플릿 문구 -> render (= run)
  llmbit install [--force]     skill/ 을 ~/.claude/skills/llmbit/ 로 복사
  llmbit analyze [--json] [--days N] [--no-shell] [--home DIR]
                               로그 집계 결과 출력. --home은 테스트용 가짜 홈
  llmbit render --analysis F --copy F [--no-open]
                               검증 -> 터미널 출력 -> 결과 URL -> 브라우저 열기

옵션:
  -h, --help                   이 도움말
  -v, --version                버전
`;

export interface ParsedArgs {
  command: Command;
  flags: Record<string, string | boolean>;
  positional: string[];
}

export function parseArgs(argv: string[]): ParsedArgs {
  const [first, ...rest] = argv;
  const isCommand = (v: string | undefined): v is Command =>
    v !== undefined && (COMMANDS as readonly string[]).includes(v);

  const command: Command = isCommand(first) ? first : "run";
  const args = isCommand(first) ? rest : argv;

  const flags: Record<string, string | boolean> = {};
  const positional: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a.startsWith("--")) {
      const [key, inline] = a.slice(2).split("=", 2);
      if (inline !== undefined) {
        flags[key!] = inline;
      } else if (args[i + 1] !== undefined && !args[i + 1]!.startsWith("-")) {
        flags[key!] = args[++i]!;
      } else {
        flags[key!] = true;
      }
    } else if (a.startsWith("-") && a.length > 1) {
      flags[a.slice(1)] = true;
    } else {
      positional.push(a);
    }
  }
  return { command, flags, positional };
}

export interface CliIo {
  stdout: (s: string) => void;
  stderr: (s: string) => void;
}

const processIo: CliIo = {
  stdout: (s) => process.stdout.write(s),
  stderr: (s) => process.stderr.write(s),
};

export function main(argv: string[], io: CliIo = processIo): number {
  if (argv.includes("--help") || argv.includes("-h")) {
    io.stdout(USAGE);
    return 0;
  }
  if (argv.includes("--version") || argv.includes("-v")) {
    io.stdout(`${version()}\n`);
    return 0;
  }

  const parsed = parseArgs(argv);
  if (parsed.command === "analyze") return runAnalyze(parsed.flags, io);
  // TODO(M3~M4): run, install, render를 src/commands/ 로 연결한다.
  io.stderr(
    `llmbit ${parsed.command}: 아직 구현되지 않았습니다 (M0 스텁). URL 경고 기준 ${URL_WARN_LENGTH}자.\n\n`,
  );
  io.stdout(USAGE);
  return 2;
}

/** tsup define으로 박히는 버전. 번들 밖(vitest)에서는 dev 표기. */
function version(): string {
  return typeof __LLMBIT_VERSION__ === "string" ? __LLMBIT_VERSION__ : "0.0.0-dev";
}

function numberFlag(v: string | boolean | undefined): number | undefined {
  if (typeof v !== "string") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function runAnalyze(flags: ParsedArgs["flags"], io: CliIo): number {
  const days = numberFlag(flags.days);
  if (flags.days !== undefined && (days === undefined || days <= 0)) {
    io.stderr("--days 는 1 이상의 숫자여야 합니다.\n");
    return 2;
  }
  const home = typeof flags.home === "string" ? flags.home : undefined;
  // --now 는 테스트용 숨은 옵션 (ISO 또는 epoch ms). fixtures 결과가 날짜에 따라 변하지 않게 한다.
  const nowRaw = typeof flags.now === "string" ? flags.now : undefined;
  const now =
    nowRaw === undefined ? undefined : /^\d+$/.test(nowRaw) ? Number(nowRaw) : Date.parse(nowRaw);
  if (now !== undefined && Number.isNaN(now)) {
    io.stderr("--now 는 ISO 날짜 또는 epoch ms 여야 합니다.\n");
    return 2;
  }
  const tz = numberFlag(flags.tz);
  const result = analyze({
    home,
    days,
    shell: flags["no-shell"] !== true,
    now,
    tzOffsetMinutes: tz,
  });
  if (flags.json === true) {
    io.stdout(JSON.stringify(result, null, 2) + "\n");
  } else {
    io.stdout(formatAnalysis(result));
  }
  return 0;
}

declare const __LLMBIT_VERSION__: string;
