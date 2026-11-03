/**
 * `llmbti` / `llmbti run` 라이트 모드 (SPEC 3장, 12장).
 *
 * analyze → insufficient면 "아직 덜 컴파일됨" + 힌트 → 템플릿 문구 → render (mode "lite").
 * 셸 히스토리는 TTY에서 한 번 묻는다 (기본 Y). --no-shell이면 안 묻고 제외, --yes면 안 묻고 포함, 비TTY면 포함.
 */

import { analyze, type AnalyzeOptions } from "./analyze";
import { formatProblems, validateCopy } from "../copy/validate";
import { buildInsufficientMessage, buildTemplateCopy } from "../templates";
import { renderResult, type RenderIo, type RenderOptions } from "./render";

export interface RunIo extends RenderIo {
  /** 입력도 TTY여야 물어볼 수 있다. 기본 process.stdin.isTTY */
  stdinIsTTY?: boolean;
  ask?: (question: string, defaultYes: boolean) => Promise<boolean>;
}

export interface RunOptions extends Omit<RenderOptions, "mode"> {
  analyze: Omit<AnalyzeOptions, "shell">;
  /** --no-shell */
  noShell: boolean;
  /** --yes: 묻지 않고 셸 포함 */
  yes: boolean;
}

export const SHELL_CONSENT_QUESTION = "셸 히스토리도 분석할까요?";

export async function decideShell(opts: RunOptions, io: RunIo): Promise<boolean> {
  if (opts.noShell) return false;
  if (opts.yes) return true;
  const stdoutTTY = io.isTTY ?? Boolean(process.stdout.isTTY);
  const stdinTTY = io.stdinIsTTY ?? Boolean(process.stdin.isTTY);
  if (!stdoutTTY || !stdinTTY || !io.ask) return true;
  return io.ask(SHELL_CONSENT_QUESTION, true);
}

export async function runCommand(opts: RunOptions, io: RunIo): Promise<number> {
  const shell = await decideShell(opts, io);
  const analysis = analyze({ ...opts.analyze, shell });

  if (analysis.insufficient) {
    const msg = buildInsufficientMessage(analysis.sampleSize);
    io.stdout(`🧩 ${msg.title}\n\n${msg.body}\n${msg.hint}\n`);
    if (!shell) io.stdout("💡 셸 히스토리를 포함하려면 --no-shell 없이 다시 실행한다.\n");
    return 0;
  }

  const copy = buildTemplateCopy(analysis.type, analysis.stats);
  const checked = validateCopy(copy);
  if (!checked.ok) {
    // 템플릿 자체의 문제라 사용자가 고칠 수 없다. 어떤 항목인지 찍고 끝낸다.
    io.stderr(`템플릿 문구가 검증을 통과하지 못했다 (${analysis.type}):\n`);
    io.stderr(formatProblems(checked.problems));
    return 1;
  }

  await renderResult(analysis, checked.copy, { ...opts, mode: "lite" }, io);
  return 0;
}
