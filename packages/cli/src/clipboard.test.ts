import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { clipboardCommands, copyToClipboard, urlFilePath, writeUrlFile } from "./clipboard";

describe("clipboard", () => {
  const dir = mkdtempSync(join(tmpdir(), "llmbti-clip-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("파일 경로는 POSIX 는 /tmp, Windows 는 TEMP", () => {
    expect(urlFilePath("darwin")).toBe("/tmp/llmbti-url.txt");
    expect(urlFilePath("linux")).toBe("/tmp/llmbti-url.txt");
    expect(urlFilePath("win32", { TEMP: "C:\\Temp" })).toMatch(/^C:\\Temp[\\/]llmbti-url\.txt$/);
  });

  it("플랫폼별 클립보드 명령", () => {
    expect(clipboardCommands("darwin").map((c) => c.cmd)).toEqual(["pbcopy"]);
    expect(clipboardCommands("win32").map((c) => c.cmd)).toEqual(["clip"]);
    expect(clipboardCommands("linux").map((c) => c.cmd)).toEqual(["wl-copy", "xclip", "xsel"]);
  });

  it("writeUrlFile 은 URL 한 줄을 쓰고 경로를 돌려준다. 못 쓰면 null", () => {
    const path = join(dir, "llmbti-url.txt");
    expect(writeUrlFile("https://llmbti.vercel.app/t/ENFP#z=abc", path)).toBe(path);
    expect(readFileSync(path, "utf8")).toBe("https://llmbti.vercel.app/t/ENFP#z=abc\n");
    expect(writeUrlFile("x", join(dir, "no-such-dir", "f.txt"))).toBeNull();
  });

  it("클립보드 명령이 전부 없으면 false (throw 하지 않는다)", async () => {
    // linux 후보(wl-copy, xclip, xsel)는 이 맥북과 CI 에 없다
    await expect(copyToClipboard("x", "linux", 500)).resolves.toBe(false);
  });
});
