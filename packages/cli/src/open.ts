/**
 * 브라우저 열기 (SPEC 12장). macOS `open`, Linux `xdg-open`, Windows `cmd /c start`.
 * 실패하면 false를 돌려주고 호출 측이 URL만 찍는다.
 */

import { spawn } from "node:child_process";

export function browserCommand(
  url: string,
  platform: NodeJS.Platform = process.platform,
): { cmd: string; args: string[] } {
  if (platform === "darwin") return { cmd: "open", args: [url] };
  // start의 첫 인자는 창 제목이라 빈 문자열을 넣는다. URL은 따옴표로 감싼다.
  if (platform === "win32") return { cmd: "cmd", args: ["/c", "start", "", `"${url}"`] };
  return { cmd: "xdg-open", args: [url] };
}

export function openBrowser(url: string, timeoutMs = 1500): Promise<boolean> {
  const { cmd, args } = browserCommand(url);
  return new Promise((resolve) => {
    let settled = false;
    const done = (ok: boolean): void => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(cmd, args, {
        stdio: "ignore",
        detached: process.platform !== "win32",
        windowsVerbatimArguments: process.platform === "win32",
      });
    } catch {
      done(false);
      return;
    }
    child.on("error", () => done(false));
    child.on("exit", (code) => done(code === 0));
    // xdg-open 같은 건 브라우저가 닫힐 때까지 안 돌아오기도 한다. 일정 시간 에러가 없으면 성공으로 본다.
    const timer = setTimeout(() => {
      child.unref();
      done(true);
    }, timeoutMs);
    timer.unref();
  });
}
