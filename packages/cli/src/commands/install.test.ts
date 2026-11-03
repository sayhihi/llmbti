import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { fixtureHome } from "../testUtils";
import {
  installCommand,
  resolveSkillSourceDir,
  resolveSkillTargetDir,
  skillFilesToCopy,
} from "./install";

const repoSkillDir = join(fixtureHome(""), "..", "skill");

function io(overrides: Partial<Parameters<typeof installCommand>[1]> = {}) {
  let out = "";
  let err = "";
  const base = {
    stdout: (s: string) => (out += s),
    stderr: (s: string) => (err += s),
    isTTY: false,
    stdinIsTTY: false,
    ...overrides,
  };
  return { io: base, out: () => out, err: () => err };
}

describe("skill source", () => {
  it("개발 환경에서는 레포 루트 skill/ 을 찾는다", () => {
    const dir = resolveSkillSourceDir();
    expect(dir).not.toBeNull();
    expect(existsSync(join(dir!, "SKILL.md"))).toBe(true);
  });

  it("SKILL.md 가 TONE.md 를 언급하지 않으면 SKILL.md 만 복사한다", () => {
    expect(skillFilesToCopy(repoSkillDir)).toEqual(["SKILL.md"]);
  });

  it("SKILL.md 는 SPEC 11장 frontmatter 와 절차, 금지 사항을 담고 TONE.md 규칙을 전부 포함한다", () => {
    const skill = readFileSync(join(repoSkillDir, "SKILL.md"), "utf8");
    const tone = readFileSync(join(repoSkillDir, "TONE.md"), "utf8");
    expect(skill.startsWith("---\nname: llmbti\n")).toBe(true);
    expect(skill).toContain(
      "description: 사용자가 /llmbti, 개발자 MBTI, llmbti 분석을 요청할 때 사용",
    );
    expect(skill).toContain("npx -y llmbti@latest analyze --json");
    expect(skill).toContain(
      "npx -y llmbti@latest render --analysis /tmp/llmbti-analysis.json --copy /tmp/llmbti-copy.json",
    );
    expect(skill).toContain("npx -y llmbti@latest install --sync");
    expect(skill).toContain("insufficient");
    expect(skill).toContain("원본 로그");
    // TONE.md 의 규칙 줄("- ")은 전부 SKILL.md 에 그대로 있어야 한다. TONE.md 가 원본이다.
    const rules = tone.split("\n").filter((l) => l.startsWith("- "));
    expect(rules.length).toBeGreaterThan(10);
    for (const r of rules) expect(skill, r).toContain(r);
  });
});

describe("installCommand", () => {
  let configDir: string;
  beforeEach(() => {
    configDir = mkdtempSync(join(tmpdir(), "llmbti-install-"));
  });
  afterEach(() => {
    rmSync(configDir, { recursive: true, force: true });
  });

  it("CLAUDE_CONFIG_DIR 아래 skills/llmbti 에 SKILL.md 를 복사하고 다음 단계를 안내한다", async () => {
    const t = io({ env: { CLAUDE_CONFIG_DIR: configDir } });
    const code = await installCommand({ force: false }, t.io);
    expect(code).toBe(0);
    const target = resolveSkillTargetDir({ CLAUDE_CONFIG_DIR: configDir });
    expect(target).toBe(join(configDir, "skills", "llmbti"));
    expect(readFileSync(join(target, "SKILL.md"), "utf8")).toContain("name: llmbti");
    expect(t.out()).toContain(target);
    expect(t.out()).toContain("Claude Code에서 /llmbti");
  });

  it("이미 있고 비TTY 면 --force 힌트와 함께 거부한다", async () => {
    const env = { CLAUDE_CONFIG_DIR: configDir };
    await installCommand({ force: false }, io({ env }).io);
    const t = io({ env });
    expect(await installCommand({ force: false }, t.io)).toBe(2);
    expect(t.err()).toContain("--force");
  });

  it("TTY 면 y/N 을 묻고, N 이면 취소, --force 면 안 묻는다", async () => {
    const env = { CLAUDE_CONFIG_DIR: configDir };
    await installCommand({ force: false }, io({ env }).io);
    const target = join(configDir, "skills", "llmbti", "SKILL.md");
    writeFileSync(target, "old");

    const asked: boolean[] = [];
    const no = io({
      env,
      isTTY: true,
      stdinIsTTY: true,
      ask: async (_q, d) => (asked.push(d), false),
    });
    expect(await installCommand({ force: false }, no.io)).toBe(0);
    expect(asked).toEqual([false]);
    expect(readFileSync(target, "utf8")).toBe("old");
    expect(no.out()).toContain("취소");

    const yes = io({ env, isTTY: true, stdinIsTTY: true, ask: async () => true });
    expect(await installCommand({ force: false }, yes.io)).toBe(0);
    expect(readFileSync(target, "utf8")).toContain("name: llmbti");

    writeFileSync(target, "old");
    const forced = io({ env, isTTY: true, stdinIsTTY: true, ask: async () => false });
    expect(await installCommand({ force: true }, forced.io)).toBe(0);
    expect(readFileSync(target, "utf8")).toContain("name: llmbti");
  });

  it("원본이 없으면 1", async () => {
    const t = io({ env: { CLAUDE_CONFIG_DIR: configDir } });
    expect(await installCommand({ force: false, sourceDir: "/nonexistent" }, t.io)).toBe(1);
  });
});

describe("install --sync", () => {
  it("없으면 설치하고, 같으면 아무것도 안 하고, 다르면 조용히 덮어쓴다", async () => {
    const { mkdtempSync, writeFileSync, readFileSync, existsSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const { installCommand, SKILL_MAIN_FILE, resolveSkillSourceDir } = await import("./install");
    const home = mkdtempSync(join(tmpdir(), "llmbti-sync-"));
    const env = { CLAUDE_CONFIG_DIR: home };
    const out: string[] = [];
    const io = { stdout: (s: string) => out.push(s), stderr: (s: string) => out.push(s), env, isTTY: false, stdinIsTTY: false };
    const src = resolveSkillSourceDir()!;
    const target = join(home, "skills", "llmbti", SKILL_MAIN_FILE);

    expect(await installCommand({ force: false, sync: true }, io)).toBe(0);
    expect(existsSync(target)).toBe(true);
    expect(out.join("")).toContain("스킬 갱신");

    out.length = 0;
    expect(await installCommand({ force: false, sync: true }, io)).toBe(0);
    expect(out.join("")).toBe("");

    writeFileSync(target, "stale\n");
    expect(await installCommand({ force: false, sync: true }, io)).toBe(0);
    expect(readFileSync(target, "utf8")).toBe(readFileSync(join(src, SKILL_MAIN_FILE), "utf8"));
    expect(out.join("")).toContain("스킬 갱신");
  });
});
