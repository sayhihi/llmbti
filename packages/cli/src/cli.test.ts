import { describe, expect, it } from "vitest";
import { main, parseArgs } from "./cli";
import type { CliIo } from "./cli";
import { fixtureHome } from "./testUtils";

function run(argv: string[]): { code: number; out: string; err: string } {
  let out = "";
  let err = "";
  const io: CliIo = { stdout: (s) => (out += s), stderr: (s) => (err += s) };
  const code = main(argv, io);
  return { code, out, err };
}

describe("parseArgs", () => {
  it("명령과 플래그", () => {
    expect(parseArgs(["analyze", "--json", "--days", "7", "--no-shell", "--home=/x"])).toEqual({
      command: "analyze",
      flags: { json: true, days: "7", "no-shell": true, home: "/x" },
      positional: [],
    });
    expect(parseArgs([]).command).toBe("run");
  });
});

describe("llmbit analyze (CLI)", () => {
  const base = [
    "analyze",
    "--home",
    fixtureHome("home-p"),
    "--now",
    "2026-11-01T12:00:00Z",
    "--tz",
    "540",
  ];

  it("--json 은 AnalysisOutput JSON 을 찍는다", () => {
    const r = run([...base, "--json"]);
    expect(r.code).toBe(0);
    expect(r.err).toBe("");
    const parsed = JSON.parse(r.out);
    expect(parsed.v).toBe(1);
    expect(parsed.type).toBe("ENFP");
    expect(parsed.insufficient).toBe(false);
    expect(parsed.sampleSize.shell).toBe(218);
  });

  it("--no-shell 이면 셸 소스를 읽지 않는다", () => {
    const parsed = JSON.parse(run([...base, "--json", "--no-shell"]).out);
    expect(parsed.sources.zsh).toBe(false);
    expect(parsed.sampleSize.shell).toBe(0);
  });

  it("--days 는 양수여야 한다", () => {
    const r = run([...base, "--days", "0"]);
    expect(r.code).toBe(2);
    expect(r.err).toContain("--days");
    expect(run([...base, "--days", "abc"]).code).toBe(2);
  });

  it("--json 이 없으면 사람용 요약", () => {
    const r = run(base);
    expect(r.code).toBe(0);
    expect(r.out).toContain("유형  ENFP");
    expect(r.out).toContain("프롬프트");
  });

  it("표본 부족이면 insufficient: true", () => {
    const parsed = JSON.parse(
      run([
        "analyze",
        "--json",
        "--home",
        fixtureHome("home-tiny"),
        "--now",
        "2026-11-01T12:00:00Z",
        "--tz",
        "540",
      ]).out,
    );
    expect(parsed.insufficient).toBe(true);
  });

  it("--help 와 아직 없는 명령", () => {
    expect(run(["--help"]).out).toContain("llmbit analyze");
    const r = run(["render"]);
    expect(r.code).toBe(2);
    expect(r.err).toContain("render");
  });
});
