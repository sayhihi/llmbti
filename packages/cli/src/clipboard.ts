/**
 * 결과 링크를 클립보드와 파일에 남긴다.
 *
 * 왜: Claude Code 안에서는 stdout 이 TTY 가 아니라 브라우저가 안 열리고, Claude 가 1,000자짜리 URL 을
 * 답변에 옮겨 적다가 중간에서 끊는 일이 있었다. 사람이 붙여넣기만 하면 되게 클립보드에 넣고,
 * 클립보드가 덮였을 때를 위해 파일에도 쓴다. 둘 다 실패해도 조용히 false 를 돌려준다.
 */

import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const URL_FILE_NAME = "llmbti-url.txt";

/** macOS, Linux 는 스킬이 쓰는 /tmp 와 같은 자리. Windows 는 %TEMP%. */
export function urlFilePath(
  platform: NodeJS.Platform = process.platform,
  env: Record<string, string | undefined> = process.env,
): string {
  if (platform === "win32") return join(env.TEMP ?? env.TMP ?? tmpdir(), URL_FILE_NAME);
  return `/tmp/${URL_FILE_NAME}`;
}

/** 링크를 파일에 쓴다. 성공하면 경로, 실패하면 null. */
export function writeUrlFile(url: string, path: string = urlFilePath()): string | null {
  try {
    writeFileSync(path, url + "\n", "utf8");
    return path;
  } catch {
    return null;
  }
}

/** 플랫폼별 클립보드 명령 후보. 앞에서부터 시도한다. */
export function clipboardCommands(
  platform: NodeJS.Platform = process.platform,
): Array<{ cmd: string; args: string[] }> {
  if (platform === "darwin") return [{ cmd: "pbcopy", args: [] }];
  if (platform === "win32") return [{ cmd: "clip", args: [] }];
  return [
    { cmd: "wl-copy", args: [] },
    { cmd: "xclip", args: ["-selection", "clipboard"] },
    { cmd: "xsel", args: ["--clipboard", "--input"] },
  ];
}

function tryCommand(
  cmd: string,
  args: string[],
  text: string,
  timeoutMs: number,
): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (ok: boolean): void => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(cmd, args, { stdio: ["pipe", "ignore", "ignore"] });
    } catch {
      done(false);
      return;
    }
    const timer = setTimeout(() => {
      child.kill();
      done(false);
    }, timeoutMs);
    child.on("error", () => {
      clearTimeout(timer);
      done(false);
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      done(code === 0);
    });
    child.stdin?.on("error", () => done(false));
    child.stdin?.end(text);
  });
}

/** 클립보드에 복사. 명령이 없거나 실패하면 false. */
export async function copyToClipboard(
  text: string,
  platform: NodeJS.Platform = process.platform,
  timeoutMs = 1500,
): Promise<boolean> {
  for (const { cmd, args } of clipboardCommands(platform)) {
    if (await tryCommand(cmd, args, text, timeoutMs)) return true;
  }
  return false;
}
