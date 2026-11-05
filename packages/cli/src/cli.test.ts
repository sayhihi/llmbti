import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { decodeResultFromHash } from "@llmbti/core";
import { afterAll, describe, expect, it } from "vitest";

import { main, parseArgs } from "./cli";
import type { CliIo } from "./cli";
import { displayWidth, stripAnsi } from "./terminal";
import { fixtureHome } from "./testUtils";

interface RunResult {
  code: number;
  out: string;
  err: string;
  opened: string[];
  asked: string[];
}

async function run(argv: string[], ioOverrides: Partial<CliIo> = {}): Promise<RunResult> {
  let out = "";
  let err = "";
  const opened: string[] = [];
  const asked: string[] = [];
  const io: CliIo = {
    stdout: (s) => (out += s),
    stderr: (s) => (err += s),
    isTTY: false,
    stdinIsTTY: false,
    columns: 100,
    env: { LLMBTI_BASE_URL: "" },
    openBrowser: async (u) => (opened.push(u), true),
    ask: async (q) => (asked.push(q), true),
    ...ioOverrides,
  };
  const code = await main(argv, io);
  return { code, out, err, opened, asked };
}

/** 마지막 줄. URL 줄 앞의 🔗 표시는 뗀다. */
function lastLine(out: string): string {
  const lines = out.trimEnd().split("\n");
  return lines[lines.length - 1]!.replace(/^🔗 /, "");
}

const fixtureP = ["--home", fixtureHome("home-p"), "--now", "2026-11-01T12:00:00Z", "--tz", "540"];
const fixtureTiny = [
  "--home",
  fixtureHome("home-tiny"),
  "--now",
  "2026-11-01T12:00:00Z",
  "--tz",
  "540",
];

describe("parseArgs", () => {
  it("명령과 플래그", () => {
    expect(parseArgs(["analyze", "--json", "--days", "7", "--no-shell", "--home=/x"])).toEqual({
      command: "analyze",
      flags: { json: true, days: "7", "no-shell": true, home: "/x" },
      positional: [],
    });
    expect(parseArgs([]).command).toBe("run");
    expect(parseArgs(["--yes", "--no-open"]).command).toBe("run");
  });
});

describe("llmbti analyze (CLI)", () => {
  const base = ["analyze", ...fixtureP];

  it("--json 은 AnalysisOutput JSON 을 찍는다", async () => {
    const r = await run([...base, "--json"]);
    expect(r.code).toBe(0);
    expect(r.err).toBe("");
    const parsed = JSON.parse(r.out);
    expect(parsed.v).toBe(1);
    expect(parsed.type).toBe("ENFP");
    expect(parsed.insufficient).toBe(false);
    expect(parsed.sampleSize.shell).toBe(218);
  });

  it("--no-shell 이면 셸 소스를 읽지 않는다", async () => {
    const parsed = JSON.parse((await run([...base, "--json", "--no-shell"])).out);
    expect(parsed.sources.zsh).toBe(false);
    expect(parsed.sampleSize.shell).toBe(0);
  });

  it("--days 는 양수여야 한다", async () => {
    const r = await run([...base, "--days", "0"]);
    expect(r.code).toBe(2);
    expect(r.err).toContain("--days");
    expect((await run([...base, "--days", "abc"])).code).toBe(2);
  });

  it("--json 이 없으면 사람용 요약", async () => {
    const r = await run(base);
    expect(r.code).toBe(0);
    expect(r.out).toContain("유형  ENFP");
    expect(r.out).toContain("프롬프트");
  });

  it("표본 부족이면 insufficient: true", async () => {
    const parsed = JSON.parse((await run(["analyze", "--json", ...fixtureTiny])).out);
    expect(parsed.insufficient).toBe(true);
  });

  it("--help 와 인자 없는 render", async () => {
    expect((await run(["--help"])).out).toContain("llmbti analyze");
    const r = await run(["render"]);
    expect(r.code).toBe(2);
    expect(r.err).toContain("render");
  });
});

describe("llmbti run (라이트 모드)", () => {
  it("fixtures/home-p → URL 의 hash 가 mode lite, type ENFP 로 디코드된다", async () => {
    const r = await run(["run", ...fixtureP, "--no-open", "--yes"]);
    expect(r.code).toBe(0);
    expect(r.err).toBe("");
    const url = lastLine(r.out);
    expect(url.startsWith("https://llmbti.vercel.app/t/ENFP#z=")).toBe(true);
    const payload = await decodeResultFromHash(url.slice(url.indexOf("#")));
    expect(payload).not.toBeNull();
    expect(payload!.mode).toBe("lite");
    expect(payload!.type).toBe("ENFP");
    expect(payload!.copy.lang).toBe("ko");
    expect(payload!.copy.evidence).toHaveLength(3);
    expect(payload!.stats.promptCount).toBe(59);
    expect(payload!.stats.forceCount).toBeDefined(); // forcePusher 배지
    expect(r.opened).toEqual([]);
    // 비TTY 라 캐릭터는 생략되고 텍스트만. 오른쪽 열 내용은 있어야 한다.
    expect(r.out).toContain("ENFP  ");
    expect(r.out).toMatch(/E [█░]{6} I/);
    expect(r.out).toContain('$ git commit -m "');
    // roast 는 별명 아래, 축 바 위에 온다
    const header = r.out.indexOf("ENFP  ");
    const bars = r.out.search(/E [█░]{6} I/);
    expect(r.out.slice(header, bars)).toContain(payload!.copy.roast.slice(0, 10));
  });

  it("같은 입력이면 같은 URL (결정적)", async () => {
    const a = await run(["run", ...fixtureP, "--no-open", "--yes"]);
    const b = await run(["run", ...fixtureP, "--no-open", "--yes"]);
    expect(lastLine(a.out)).toBe(lastLine(b.out));
  });

  it("명령 없이 실행해도 run 이고, --base 와 LLMBTI_BASE_URL 을 따른다", async () => {
    const flag = await run([...fixtureP, "--no-open", "--yes", "--base", "http://localhost:4173/"]);
    expect(lastLine(flag.out).startsWith("http://localhost:4173/t/ENFP#z=")).toBe(true);
    const env = await run([...fixtureP, "--no-open", "--yes"], {
      env: { LLMBTI_BASE_URL: "http://x.test" },
    });
    expect(lastLine(env.out).startsWith("http://x.test/t/ENFP#z=")).toBe(true);
  });

  it("TTY 면 셸 질문을 한 번 하고, 브라우저를 연다. --no-shell/--yes 면 안 묻는다", async () => {
    const tty = { isTTY: true, stdinIsTTY: true, env: { TERM: "dumb" } };
    const asked = await run(["run", ...fixtureP], tty);
    expect(asked.asked).toEqual(["셸 히스토리도 분석할까요?"]);
    expect(asked.opened).toHaveLength(1);
    expect(asked.opened[0]).toBe(lastLine(asked.out));

    const noShell = await run(["run", ...fixtureP, "--no-shell", "--no-open"], tty);
    expect(noShell.asked).toEqual([]);
    expect(noShell.opened).toEqual([]);
    const yes = await run(["run", ...fixtureP, "--yes", "--no-open"], tty);
    expect(yes.asked).toEqual([]);
  });

  it("질문에 n 이면 셸을 빼고 분석한다", async () => {
    const r = await run(["run", ...fixtureP, "--no-open"], {
      isTTY: true,
      stdinIsTTY: true,
      env: { TERM: "dumb" },
      ask: async () => false,
    });
    const payload = await decodeResultFromHash(lastLine(r.out).slice(lastLine(r.out).indexOf("#")));
    expect(payload!.sampleSize.shell).toBe(0);
  });

  it("브라우저 열기에 실패하면 안내만 하고 0", async () => {
    const r = await run(["run", ...fixtureP, "--yes"], {
      isTTY: true,
      stdinIsTTY: true,
      env: { TERM: "dumb" },
      openBrowser: async () => false,
    });
    expect(r.code).toBe(0);
    expect(r.err).toContain("브라우저를 열지 못했다");
  });

  it("표본 부족이면 덜 컴파일됨 메시지와 힌트, exit 0, URL 없음", async () => {
    const r = await run(["run", ...fixtureTiny, "--no-open", "--yes"]);
    expect(r.code).toBe(0);
    expect(r.out).toContain("아직 덜 컴파일됨");
    expect(r.out).toContain("다시");
    expect(r.out).not.toContain("#z=");
  });

  it("truecolor + 폭 100 이면 캐릭터 16줄 옆에 텍스트, 폭 60 이면 세로 스택", async () => {
    const wide = await run([
      "run",
      ...fixtureP,
      "--no-open",
      "--yes",
      "--color",
      "truecolor",
      "--width",
      "100",
    ]);
    const lines = wide.out.trimEnd().split("\n");
    expect(lines[0]).toContain("\x1b[");
    expect(stripAnsi(lines[0]!)).toMatch(/^.{32} {2}ENFP {2}/);
    // 캐릭터 16줄 (투명한 행은 ANSI 없이 비어 있을 수 있다) → (오른쪽 열이 더 길면 그 나머지) → 빈 줄 → URL
    expect(lines.slice(0, 16).filter((l) => l.includes("\x1b[")).length).toBeGreaterThanOrEqual(14);
    const urlIdx = lines.length - 1;
    expect(urlIdx).toBeGreaterThanOrEqual(17);
    expect(lines[urlIdx - 1]).toBe("");
    expect(lines[urlIdx]).toMatch(/^🔗 https:\/\/llmbti\.vercel\.app\/t\/ENFP#z=/);
    // 별명 다음 줄은 빈 칸, 그 다음부터 roast 가 캐릭터 옆 66칸 안에서 접힌다
    expect(stripAnsi(lines[1]!).slice(34).trim()).toBe("");
    expect(stripAnsi(lines[2]!)).toMatch(/^.{32} {2}\S/);
    for (const l of lines.slice(0, urlIdx - 1)) {
      const right = stripAnsi(l).slice(34);
      expect(displayWidth(right)).toBeLessThanOrEqual(66);
    }

    const narrow = await run([
      "run",
      ...fixtureP,
      "--no-open",
      "--yes",
      "--color",
      "truecolor",
      "--width",
      "60",
    ]);
    const nlines = narrow.out.split("\n");
    expect(stripAnsi(nlines[0]!)).not.toContain("ENFP");
    expect(nlines[16]).toBe("");
    expect(nlines[17]).toMatch(/^ENFP {2}/);
    for (const l of nlines.slice(17))
      if (!/^(🔗 )?http/.test(l)) expect(l.length).toBeLessThanOrEqual(60);
  });
});

describe("llmbti render", () => {
  const dir = mkdtempSync(join(tmpdir(), "llmbti-render-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  const analysisPath = join(dir, "analysis.json");
  const copyPath = join(dir, "copy.json");
  const goodCopy = {
    lang: "ko",
    nickname: "새벽 force push 직배포러",
    roast: "--force push 11번, 그중 7번이 새벽 3시다. 브랜치를 안 따고 main에서 쏜다.",
    evidence: ["--force push 11번", "새벽 2시에서 5시 사이 활동 34%", "커밋 메시지 중 fix 48%"],
    commitMessage: "fix: prod again",
    pairWith: { type: "INFJ", reason: "쏘고 나면 문서는 저쪽이 써 줌" },
  };

  async function writeAnalysis(argv: string[]): Promise<void> {
    const r = await run(["analyze", "--json", ...argv]);
    writeFileSync(analysisPath, r.out);
  }

  it("좋은 copy 는 mode claude URL 을 찍고 브라우저를 연다 (TTY)", async () => {
    await writeAnalysis(fixtureP);
    writeFileSync(copyPath, JSON.stringify(goodCopy));
    const r = await run(["render", "--analysis", analysisPath, "--copy", copyPath], {
      isTTY: true,
      stdinIsTTY: true,
      env: { TERM: "dumb" },
    });
    expect(r.code).toBe(0);
    expect(r.err).toBe("");
    const url = lastLine(r.out);
    expect(r.opened).toEqual([url]);
    const payload = await decodeResultFromHash(url.slice(url.indexOf("#")));
    expect(payload!.mode).toBe("claude");
    expect(payload!.type).toBe("ENFP");
    expect(payload!.copy.nickname).toBe(goodCopy.nickname);
    expect(r.out).toContain("- --force push 11번");
    // roast 는 별명 아래, 축 바 위
    const header = r.out.indexOf("ENFP  새벽 force push 직배포러");
    const bars = r.out.search(/E [█░]{6} I/);
    expect(header).toBeGreaterThanOrEqual(0);
    expect(r.out.slice(header, bars)).toContain("그중 7번이 새벽 3시다");
  });

  it("문구 속 시크릿은 redact 되어 URL 에 실린다", async () => {
    writeFileSync(
      copyPath,
      JSON.stringify({
        ...goodCopy,
        roast: "sk-abcdefghijklmnopqrstuvwxyz 를 3번 붙였다. 대단하다.",
      }),
    );
    const r = await run(["render", "--analysis", analysisPath, "--copy", copyPath, "--no-open"]);
    expect(r.code).toBe(0);
    const url = lastLine(r.out);
    const payload = await decodeResultFromHash(url.slice(url.indexOf("#")));
    expect(payload!.copy.roast).toContain("[SK_TOKEN]");
  });

  it("나쁜 copy 는 번호 목록을 stderr 에 찍고 2", async () => {
    writeFileSync(
      copyPath,
      JSON.stringify({ ...goodCopy, nickname: "가".repeat(25), evidence: ["숫자 없음", "2번"] }),
    );
    const r = await run(["render", "--analysis", analysisPath, "--copy", copyPath, "--no-open"]);
    expect(r.code).toBe(2);
    expect(r.out).toBe("");
    expect(r.err).toContain("1. nickname: 20자 이하");
    expect(r.err).toContain("2. evidence: 정확히 3개");
    expect(r.err).toContain("3. evidence[1]: 숫자");
  });

  it("insufficient 분석 파일이면 2", async () => {
    await writeAnalysis(fixtureTiny);
    writeFileSync(copyPath, JSON.stringify(goodCopy));
    const r = await run(["render", "--analysis", analysisPath, "--copy", copyPath, "--no-open"]);
    expect(r.code).toBe(2);
    expect(r.err).toContain("아직 덜 컴파일됨");
  });

  it("파일이 없거나 JSON 이 아니면 2", async () => {
    writeFileSync(copyPath, "{nope");
    await writeAnalysis(fixtureP);
    expect((await run(["render", "--analysis", analysisPath, "--copy", copyPath])).code).toBe(2);
    expect(
      (await run(["render", "--analysis", "/nonexistent.json", "--copy", copyPath])).code,
    ).toBe(2);
    writeFileSync(analysisPath, JSON.stringify({ v: 1 }));
    writeFileSync(copyPath, JSON.stringify(goodCopy));
    const r = await run(["render", "--analysis", analysisPath, "--copy", copyPath]);
    expect(r.code).toBe(2);
    expect(r.err).toContain("analyze --json");
  });
});

describe("링크 전달 (클립보드, 파일, --no-url)", () => {
  const argv = ["run", ...fixtureP, "--no-open", "--yes"];

  it("클립보드와 파일이 되면 안내 줄 다음에 URL 줄", async () => {
    const copied: string[] = [];
    const r = await run(argv, {
      copyToClipboard: async (u) => (copied.push(u), true),
      writeUrlFile: () => "/tmp/llmbti-url.txt",
    });
    const lines = r.out.trimEnd().split("\n");
    const url = lastLine(r.out);
    expect(url.startsWith("https://llmbti.vercel.app/t/ENFP#z=")).toBe(true);
    expect(lines[lines.length - 2]).toBe(
      "📋 링크를 클립보드에 복사했다. 파일: /tmp/llmbti-url.txt",
    );
    expect(lines[lines.length - 3]).toBe("");
    expect(copied).toEqual([url]);
  });

  it("--no-url 이면 URL 줄을 숨기고 안내만 남긴다", async () => {
    const r = await run([...argv, "--no-url"], {
      copyToClipboard: async () => true,
      writeUrlFile: () => "/tmp/llmbti-url.txt",
    });
    expect(r.out).not.toContain("#z=");
    expect(lastLine(r.out)).toBe("📋 링크를 클립보드에 복사했다. 파일: /tmp/llmbti-url.txt");
  });

  it("클립보드만 실패하면 파일 안내, 둘 다 실패하면 --no-url 이어도 URL 을 찍는다", async () => {
    const fileOnly = await run([...argv, "--no-url"], {
      copyToClipboard: async () => false,
      writeUrlFile: () => "/tmp/llmbti-url.txt",
    });
    expect(lastLine(fileOnly.out)).toBe("📄 링크를 파일에 써 뒀다: /tmp/llmbti-url.txt");
    expect(fileOnly.out).not.toContain("#z=");

    const neither = await run([...argv, "--no-url"], {
      copyToClipboard: async () => false,
      writeUrlFile: () => null,
    });
    expect(lastLine(neither.out).startsWith("https://llmbti.vercel.app/t/ENFP#z=")).toBe(true);
    expect(neither.out).not.toContain("📋");
  });
});
