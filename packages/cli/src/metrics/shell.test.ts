import { describe, expect, it } from "vitest";
import {
  classifyCommand,
  commandName,
  extractCommitMessage,
  isForceful,
  isLowQualityCommitMessage,
} from "./shell";

describe("commandName", () => {
  it("첫 파이프라인 세그먼트의 명령어, 접두 제거", () => {
    expect(commandName("git status")).toBe("git");
    expect(commandName("sudo apt install x")).toBe("apt");
    expect(commandName("FOO=1 BAR=2 pnpm dev")).toBe("pnpm");
    expect(commandName("cat a | grep b && ls")).toBe("cat");
    expect(commandName("./gradlew test")).toBe("gradlew");
    expect(commandName("/usr/bin/python3 x.py")).toBe("python3");
    expect(commandName("   ")).toBeUndefined();
    expect(commandName("sudo !!")).toBe("sudo");
  });
});

describe("classifyCommand", () => {
  it("테스트 실행", () => {
    for (const c of [
      "pnpm test",
      "npm run test",
      "yarn test:unit",
      "npx vitest run",
      "vitest",
      "jest --watch",
      "pytest -q",
      "go test ./...",
      "cargo test",
      "./gradlew test",
      "make test",
      "python -m pytest",
      "dotnet test",
    ]) {
      expect(classifyCommand(c).test, c).toBe(true);
    }
    for (const c of ["pnpm dev", "git status", "ls tests/", "echo test", "pnpm build"]) {
      expect(classifyCommand(c).test, c).toBe(false);
    }
  });

  it("force push / reset --hard / rm -rf / 기타 --force", () => {
    expect(classifyCommand("git push --force origin main").forcePush).toBe(true);
    expect(classifyCommand("git push -f").forcePush).toBe(true);
    expect(classifyCommand("git push --force-with-lease").forcePush).toBe(true);
    expect(classifyCommand("git push -uf origin x").forcePush).toBe(true);
    expect(classifyCommand("git push origin main").forcePush).toBe(false);
    expect(classifyCommand("git push --follow-tags").forcePush).toBe(false);

    expect(classifyCommand("git reset --hard HEAD~1").resetHard).toBe(true);
    expect(classifyCommand("git reset --soft HEAD~1").resetHard).toBe(false);

    expect(classifyCommand("rm -rf node_modules").rmRf).toBe(true);
    expect(classifyCommand("rm -fr dist").rmRf).toBe(true);
    expect(classifyCommand("rm -r -f dist").rmRf).toBe(true);
    expect(classifyCommand("sudo rm -rf /tmp/x").rmRf).toBe(true);
    expect(classifyCommand("cd a && rm -rf b").rmRf).toBe(true);
    expect(classifyCommand("rm -r dist").rmRf).toBe(false);
    expect(classifyCommand("rm file").rmRf).toBe(false);
    expect(classifyCommand("npm run rm-rf-not-really").rmRf).toBe(false);

    const npmForce = classifyCommand("npm i --force");
    expect(npmForce.otherForce).toBe(true);
    expect(npmForce.forcePush).toBe(false);
    expect(isForceful(npmForce)).toBe(true);
    expect(isForceful(classifyCommand("git status"))).toBe(false);
  });

  it("sudo !!", () => {
    expect(classifyCommand("sudo !!").sudoBang).toBe(true);
    expect(classifyCommand("sudo ls").sudoBang).toBe(false);
  });

  it("커밋 메시지 추출과 저품질 판정", () => {
    expect(extractCommitMessage('git commit -m "feat: add x"')).toBe("feat: add x");
    expect(extractCommitMessage("git commit -am 'wip'")).toBe("wip");
    expect(extractCommitMessage("git commit -m fix")).toBe("fix");
    expect(extractCommitMessage('git commit --message="asdf"')).toBe("asdf");
    expect(extractCommitMessage("git commit")).toBeUndefined();
    expect(extractCommitMessage("git status")).toBeUndefined();
    expect(
      extractCommitMessage("git commit -m \"$(cat <<'EOF'\nfeat(cli): 파서 추가\n\n본문\nEOF\n)\""),
    ).toBe("feat(cli): 파서 추가");

    for (const m of ["fix", "wip", ".", "asdf", "update", "수정", "ㅇㅇ", "test", "...", "a"]) {
      expect(isLowQualityCommitMessage(m), m).toBe(true);
    }
    for (const m of ["fix: handle empty history", "feat(cli): zsh parser", "파서 멀티라인 처리"]) {
      expect(isLowQualityCommitMessage(m), m).toBe(false);
    }
    expect(classifyCommand('git commit -m "wip"').lowQualityCommit).toBe(true);
    expect(classifyCommand('git commit -m "fix: real message"').lowQualityCommit).toBe(false);
    expect(classifyCommand("ls").lowQualityCommit).toBe(false);
  });
});
