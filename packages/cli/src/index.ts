/**
 * llmbit CLI 진입점 (M0 스텁).
 * 명령 구현은 M1(analyze), M3(render), M4(install, run)에서 src/commands/ 아래에 들어간다.
 */

import { URL_WARN_LENGTH } from "@llmbit/core";

const COMMANDS = ["run", "install", "analyze", "render"] as const;
type Command = (typeof COMMANDS)[number];

const USAGE = `llmbit - LLM에게 일을 시키는 패턴으로 보는 개발자 MBTI

사용법:
  llmbit                       라이트 모드: analyze -> 템플릿 문구 -> render (= run)
  llmbit install [--force]     skill/ 을 ~/.claude/skills/llmbit/ 로 복사
  llmbit analyze [--json] [--days N] [--no-shell]
                               로그 집계 결과 출력
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

function main(argv: string[]): number {
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(USAGE);
    return 0;
  }
  if (argv.includes("--version") || argv.includes("-v")) {
    process.stdout.write(`${__LLMBIT_VERSION__}\n`);
    return 0;
  }

  const parsed = parseArgs(argv);
  // TODO(M1~M4): 각 명령을 src/commands/{run,install,analyze,render}.ts로 연결한다.
  process.stderr.write(
    `llmbit ${parsed.command}: 아직 구현되지 않았습니다 (M0 스텁). URL 경고 기준 ${URL_WARN_LENGTH}자.\n\n`,
  );
  process.stdout.write(USAGE);
  return 2;
}

declare const __LLMBIT_VERSION__: string;

process.exitCode = main(process.argv.slice(2));
