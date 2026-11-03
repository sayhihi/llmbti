/**
 * `llmbti install [--force] [--sync]` (SPEC 3장, 11장, 12장).
 *
 * `--sync`: 묻지 않고 조용히 최신으로 맞춘다. 설치된 SKILL.md 가 패키지 동봉본과 같으면 아무것도 안 하고,
 * 다르거나 없으면 덮어쓴다. 스킬 절차 첫 줄에서 실행해서 이미 설치한 사용자도 자동으로 버전업되게 한다.
 *
 * skill/SKILL.md를 `~/.claude/skills/llmbti/`로 복사한다. `CLAUDE_CONFIG_DIR`가 있으면 그 아래 skills/llmbti.
 * 스킬 파일은 빌드 때 packages/cli/skill/ 로 복사돼 npm 패키지에 들어간다 (tsup onSuccess).
 * 런타임에는 번들(dist/index.js) 기준 상대 경로로 찾고, 없으면 레포 루트의 skill/ (개발 환경).
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const SKILL_NAME = "llmbti";
export const SKILL_MAIN_FILE = "SKILL.md";
export const SKILL_TONE_FILE = "TONE.md";

/**
 * 스킬 원본 디렉터리 후보. 이 파일이 어디서 실행되든 하나는 맞는다.
 * - dist/index.js (번들):        ../skill        → packages/cli/skill (패키지 동봉)
 * - dist/index.js (레포 안 빌드): ../../../skill  → <repo>/skill
 * - src/commands/install.ts (tsx, vitest): ../../../../skill → <repo>/skill
 */
export function skillSourceCandidates(fromUrl: string = import.meta.url): string[] {
  const here = fileURLToPath(fromUrl);
  return ["../skill", "../../../skill", "../../../../skill"].map((rel) => join(here, "..", rel));
}

export function resolveSkillSourceDir(fromUrl?: string): string | null {
  for (const dir of skillSourceCandidates(fromUrl)) {
    if (existsSync(join(dir, SKILL_MAIN_FILE))) return dir;
  }
  return null;
}

export function resolveClaudeConfigDir(
  env: Record<string, string | undefined> = process.env,
): string {
  const custom = env.CLAUDE_CONFIG_DIR;
  if (typeof custom === "string" && custom.trim() !== "") return custom.trim();
  return join(homedir(), ".claude");
}

export function resolveSkillTargetDir(env?: Record<string, string | undefined>): string {
  return join(resolveClaudeConfigDir(env), "skills", SKILL_NAME);
}

/** 복사할 파일 목록. SKILL.md는 항상, TONE.md는 SKILL.md가 언급할 때만. */
export function skillFilesToCopy(sourceDir: string): string[] {
  const files = [SKILL_MAIN_FILE];
  const main = readFileSync(join(sourceDir, SKILL_MAIN_FILE), "utf8");
  if (main.includes(SKILL_TONE_FILE) && existsSync(join(sourceDir, SKILL_TONE_FILE))) {
    files.push(SKILL_TONE_FILE);
  }
  return files;
}

export interface InstallIo {
  stdout: (s: string) => void;
  stderr: (s: string) => void;
  isTTY?: boolean;
  stdinIsTTY?: boolean;
  env?: Record<string, string | undefined>;
  ask?: (question: string, defaultYes: boolean) => Promise<boolean>;
}

export interface InstallOptions {
  force: boolean;
  /** 묻지 않고 패키지 동봉본과 다를 때만 덮어쓴다 */
  sync?: boolean;
  /** 테스트용: 스킬 원본 디렉터리 강제 */
  sourceDir?: string;
}

export async function installCommand(opts: InstallOptions, io: InstallIo): Promise<number> {
  const env = io.env ?? process.env;
  const sourceDir = opts.sourceDir ?? resolveSkillSourceDir();
  if (!sourceDir || !existsSync(join(sourceDir, SKILL_MAIN_FILE))) {
    io.stderr("스킬 원본(skill/SKILL.md)을 찾을 수 없다. 패키지가 깨졌거나 빌드가 안 된 상태다.\n");
    return 1;
  }
  const targetDir = resolveSkillTargetDir(env);
  const targetMain = join(targetDir, SKILL_MAIN_FILE);

  if (opts.sync) {
    const files = skillFilesToCopy(sourceDir);
    const same =
      existsSync(targetMain) &&
      files.every((f) => {
        const t = join(targetDir, f);
        return existsSync(t) && readFileSync(t, "utf8") === readFileSync(join(sourceDir, f), "utf8");
      });
    if (same) return 0;
    mkdirSync(targetDir, { recursive: true });
    for (const f of files) copyFileSync(join(sourceDir, f), join(targetDir, f));
    io.stdout(`🔄 스킬 갱신: ${targetDir}\n`);
    return 0;
  }

  if (existsSync(targetMain) && !opts.force) {
    const stdoutTTY = io.isTTY ?? Boolean(process.stdout.isTTY);
    const stdinTTY = io.stdinIsTTY ?? Boolean(process.stdin.isTTY);
    if (!stdoutTTY || !stdinTTY || !io.ask) {
      io.stderr(`⚠️  이미 설치돼 있다: ${targetDir}\n덮어쓰려면 --force 를 붙여서 다시 실행한다.\n`);
      return 2;
    }
    const yes = await io.ask(`⚠️  이미 설치돼 있다: ${targetDir}\n덮어쓸까요?`, false);
    if (!yes) {
      io.stdout("🚫 취소했다. 덮어쓰려면 --force 를 붙여서 다시 실행한다.\n");
      return 0;
    }
  }

  mkdirSync(targetDir, { recursive: true });
  const files = skillFilesToCopy(sourceDir);
  for (const f of files) copyFileSync(join(sourceDir, f), join(targetDir, f));

  io.stdout(`✅ 설치 완료: ${targetDir} (${files.join(", ")})\n`);
  io.stdout("👉 다음: Claude Code에서 /llmbti\n");
  return 0;
}
