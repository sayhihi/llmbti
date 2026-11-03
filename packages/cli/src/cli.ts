/**
 * llmbti CLI 본체. index.ts가 process.argv로 main을 부른다.
 * 테스트는 io를 주입해서 stdout/stderr, TTY 여부, 질문 응답, 브라우저 열기를 잡는다.
 */

import { analyze, formatAnalysis } from "./commands/analyze";
import { installCommand } from "./commands/install";
import { renderCommand } from "./commands/render";
import { runCommand } from "./commands/run";
import { openBrowser } from "./open";
import { askYesNo } from "./prompt";

const COMMANDS = ["run", "install", "analyze", "render"] as const;
type Command = (typeof COMMANDS)[number];

const USAGE = `llmbti - LLM에게 일을 시키는 패턴으로 보는 개발자 MBTI

사용법:
  llmbti [run] [--days N] [--no-shell] [--yes] [--no-open] [--base URL]
                               라이트 모드: analyze -> 템플릿 문구 -> render
  llmbti install [--force]     skill/ 을 ~/.claude/skills/llmbti/ 로 복사 (CLAUDE_CONFIG_DIR 존중)
  llmbti analyze [--json] [--days N] [--no-shell] [--home DIR]
                               로그 집계 결과 출력. --home은 테스트용 가짜 홈
  llmbti render --analysis F --copy F [--no-open] [--base URL]
                               검증 -> 터미널 출력 -> 결과 URL -> 브라우저 열기

옵션:
  --days N                     분석 기간 (기본 30일)
  --no-shell                   셸 히스토리 제외
  --yes                        셸 히스토리 질문을 건너뛰고 포함
  --no-open                    브라우저를 열지 않음
  --base URL                   결과 페이지 주소 (기본 https://llmbti.vercel.app, env LLMBTI_BASE_URL)
  --no-color                   캐릭터 생략
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
  /** 기본 process.stdout.isTTY */
  isTTY?: boolean;
  /** 기본 process.stdin.isTTY */
  stdinIsTTY?: boolean;
  /** 기본 process.stdout.columns */
  columns?: number;
  /** 기본 process.env */
  env?: Record<string, string | undefined>;
  /** y/N 질문. 기본 readline. 테스트는 고정 답을 넣는다 */
  ask?: (question: string, defaultYes: boolean) => Promise<boolean>;
  /** 브라우저 열기. 기본 open/xdg-open/start */
  openBrowser?: (url: string) => Promise<boolean>;
}

const processIo: CliIo = {
  stdout: (s) => process.stdout.write(s),
  stderr: (s) => process.stderr.write(s),
  ask: askYesNo,
  openBrowser,
};

export async function main(argv: string[], io: CliIo = processIo): Promise<number> {
  if (argv.includes("--help") || argv.includes("-h")) {
    io.stdout(USAGE);
    return 0;
  }
  if (argv.includes("--version") || argv.includes("-v")) {
    io.stdout(`${version()}\n`);
    return 0;
  }

  const parsed = parseArgs(argv);
  const { flags } = parsed;
  switch (parsed.command) {
    case "analyze":
      return runAnalyze(flags, io);
    case "install":
      return installCommand({ force: flags.force === true }, io);
    case "render": {
      const analysisPath = stringFlag(flags.analysis);
      const copyPath = stringFlag(flags.copy);
      if (!analysisPath || !copyPath) {
        io.stderr("llmbti render: --analysis 파일과 --copy 파일이 둘 다 필요하다.\n\n");
        io.stdout(USAGE);
        return 2;
      }
      return renderCommand(
        {
          analysisPath,
          copyPath,
          base: flags.base,
          open: flags["no-open"] !== true,
          color: flags.color,
          width: numberFlag(flags.width),
          argv,
        },
        io,
      );
    }
    case "run": {
      const analyzeOpts = parseAnalyzeFlags(flags, io);
      if (analyzeOpts === null) return 2;
      return runCommand(
        {
          analyze: analyzeOpts,
          noShell: flags["no-shell"] === true,
          yes: flags.yes === true,
          base: flags.base,
          open: flags["no-open"] !== true,
          color: flags.color,
          width: numberFlag(flags.width),
          argv,
        },
        io,
      );
    }
  }
}

/** tsup define으로 박히는 버전. 번들 밖(vitest)에서는 dev 표기. */
function version(): string {
  return typeof __LLMBTI_VERSION__ === "string" ? __LLMBTI_VERSION__ : "0.0.0-dev";
}

function stringFlag(v: string | boolean | undefined): string | undefined {
  return typeof v === "string" && v !== "" ? v : undefined;
}

function numberFlag(v: string | boolean | undefined): number | undefined {
  if (typeof v !== "string") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

interface AnalyzeFlags {
  home?: string;
  days?: number;
  now?: number;
  tzOffsetMinutes?: number;
}

/** analyze와 run이 공유하는 옵션. 잘못되면 메시지를 찍고 null. */
function parseAnalyzeFlags(flags: ParsedArgs["flags"], io: CliIo): AnalyzeFlags | null {
  const days = numberFlag(flags.days);
  if (flags.days !== undefined && (days === undefined || days <= 0)) {
    io.stderr("--days 는 1 이상의 숫자여야 합니다.\n");
    return null;
  }
  const home = stringFlag(flags.home);
  // --now 는 테스트용 숨은 옵션 (ISO 또는 epoch ms). fixtures 결과가 날짜에 따라 변하지 않게 한다.
  const nowRaw = stringFlag(flags.now);
  const now =
    nowRaw === undefined ? undefined : /^\d+$/.test(nowRaw) ? Number(nowRaw) : Date.parse(nowRaw);
  if (now !== undefined && Number.isNaN(now)) {
    io.stderr("--now 는 ISO 날짜 또는 epoch ms 여야 합니다.\n");
    return null;
  }
  return { home, days, now, tzOffsetMinutes: numberFlag(flags.tz) };
}

function runAnalyze(flags: ParsedArgs["flags"], io: CliIo): number {
  const opts = parseAnalyzeFlags(flags, io);
  if (opts === null) return 2;
  const result = analyze({ ...opts, shell: flags["no-shell"] !== true });
  if (flags.json === true) {
    io.stdout(JSON.stringify(result, null, 2) + "\n");
  } else {
    io.stdout(formatAnalysis(result));
  }
  return 0;
}

declare const __LLMBTI_VERSION__: string;
