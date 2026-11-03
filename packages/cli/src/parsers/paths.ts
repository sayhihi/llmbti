/**
 * 로그 파일 위치 (SPEC 5장). `--home`으로 테스트와 fixtures가 가짜 홈을 가리킬 수 있다.
 * Windows는 `%USERPROFILE%\.claude`.
 */

import { homedir } from "node:os";
import { join } from "node:path";

export interface LogPaths {
  home: string;
  claudeHistory: string;
  claudeProjects: string;
  zshHistory: string;
  bashHistory: string;
}

export interface ResolveOptions {
  home?: string;
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
}

export function resolveHome(opts: ResolveOptions = {}): string {
  if (opts.home) return opts.home;
  const env = opts.env ?? process.env;
  const platform = opts.platform ?? process.platform;
  if (platform === "win32" && env.USERPROFILE) return env.USERPROFILE;
  if (env.HOME) return env.HOME;
  return homedir();
}

export function resolveLogPaths(opts: ResolveOptions = {}): LogPaths {
  const home = resolveHome(opts);
  const env = opts.env ?? process.env;
  const claudeDir = opts.home
    ? join(home, ".claude")
    : env.CLAUDE_CONFIG_DIR && env.CLAUDE_CONFIG_DIR.length > 0
      ? env.CLAUDE_CONFIG_DIR
      : join(home, ".claude");
  // --home이 주어지면 HISTFILE 같은 환경변수는 무시한다 (fixtures 격리).
  const zsh = !opts.home && env.HISTFILE ? env.HISTFILE : join(home, ".zsh_history");
  return {
    home,
    claudeHistory: join(claudeDir, "history.jsonl"),
    claudeProjects: join(claudeDir, "projects"),
    zshHistory: zsh,
    bashHistory: join(home, ".bash_history"),
  };
}
