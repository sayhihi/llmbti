/**
 * TTY에서 y/N 질문. 호출 측이 TTY인지 먼저 확인한다 (비TTY에서는 기본값을 쓰거나 거부한다).
 */

import { createInterface } from "node:readline";

export async function askYesNo(question: string, defaultYes: boolean): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const suffix = defaultYes ? " [Y/n] " : " [y/N] ";
  try {
    const answer = await new Promise<string>((resolve) => rl.question(question + suffix, resolve));
    const a = answer.trim().toLowerCase();
    if (a === "") return defaultYes;
    return a === "y" || a === "yes" || a === "ㅛ";
  } finally {
    rl.close();
  }
}
