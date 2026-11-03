/**
 * 셸 명령 분류 (SPEC 6장 J/P 시그널 + 재미용 통계).
 * 셸 히스토리와 Claude Bash 툴의 command 둘 다 여기로 들어온다.
 */

export interface CommandFlags {
  /** 인자를 뗀 명령어 이름. 빈 줄이면 undefined */
  name?: string;
  test: boolean;
  /** `git push --force` / `-f` / `--force-with-lease` */
  forcePush: boolean;
  /** `git reset --hard` */
  resetHard: boolean;
  rmRf: boolean;
  /** 그 밖의 `--force` (npm i --force, git branch -D 등은 제외) */
  otherForce: boolean;
  sudoBang: boolean;
  /** git commit 메시지 (뽑을 수 있을 때만) */
  commitMessage?: string;
  lowQualityCommit: boolean;
}

const ENV_ASSIGN = /^[A-Za-z_][A-Za-z0-9_]*=\S*$/;
const WRAPPERS = new Set([
  "sudo",
  "time",
  "nohup",
  "command",
  "builtin",
  "exec",
  "env",
  "nice",
  "doas",
]);

/** 첫 번째 파이프라인 세그먼트의 명령어 이름. `sudo`, `FOO=bar` 같은 접두는 건너뛴다. */
export function commandName(command: string): string | undefined {
  const first = command.split(/\s*(?:\|\||&&|;|\|)\s*/)[0] ?? "";
  const tokens = first.trim().split(/\s+/).filter(Boolean);
  for (const tok of tokens) {
    if (ENV_ASSIGN.test(tok)) continue;
    if (WRAPPERS.has(tok)) continue;
    if (tok.startsWith("-")) continue;
    // 절대 경로나 상대 경로로 실행한 바이너리는 파일 이름만 남긴다 (./gradlew → gradlew).
    const base = tok.replace(/^.*\//, "");
    return base || tok;
  }
  return undefined;
}

const TEST_RUNNER =
  /(^|[\s;&|(])(?:vitest|jest|pytest|mocha|cypress|playwright|rspec|phpunit|ctest|tox|nose2?)\b|\bgo\s+test\b|\bcargo\s+test\b|\bdotnet\s+test\b|\b(?:npm|pnpm|yarn|bun|deno)\s+(?:run\s+)?test(?::\w+)?\b|\b(?:npx|pnpx|bunx)\s+(?:vitest|jest|playwright|cypress)\b|\b(?:gradlew?|mvn|mvnw|make|just|rake|mix|sbt|swift|flutter)\s+(?:\S+\s+)*?test\b|\bpython3?\s+-m\s+(?:pytest|unittest)\b/;

const FORCE_PUSH =
  /\bgit\s+push\b[^|&;]*?\s(?:--force(?:-with-lease)?|-f|-[a-zA-Z]*f[a-zA-Z]*)(?=\s|$)/;
const RESET_HARD = /\bgit\s+reset\s+(?:\S+\s+)*?--hard\b/;
const RM_RF =
  /(^|[\s;&|(])rm\s+(?:-[a-zA-Z]*\s+)*-[a-zA-Z]*(?:rf|fr)[a-zA-Z]*\b|(^|[\s;&|(])rm\s+(?:-r\s+-f|-f\s+-r|--recursive\s+--force|--force\s+--recursive)\b/;
const OTHER_FORCE = /\s--force\b/;
const SUDO_BANG = /\bsudo\s+!!/;

const COMMIT_MSG =
  /\bgit\s+commit\b[^|&;]*?(?:\s-[a-zA-Z]*m\s*|\s--message(?:=|\s+))(?:(["'])([\s\S]*?)\1|(\S+))/;

const LOW_QUALITY_MSG =
  /^(?:fix(?:es|ed)?|wip|update[sd]?|test(?:s|ing)?|asdf|qwer|temp|tmp|minor|changes?|commit|save|stuff|misc|bug ?fix|typo|clean ?up|lint|format|refactor|오타|수정|고침|임시|작업|변경|테스트|커밋|저장|ㅁㄴㅇㄹ|ㅇㅇ|ㅋㅋ|\.+|-+|_+|!+|\?+)[.!]*$/i;

export function isLowQualityCommitMessage(message: string): boolean {
  const msg = message.trim();
  if (msg.length === 0) return true;
  if ([...msg].length <= 3) return true;
  return LOW_QUALITY_MSG.test(msg);
}

export function extractCommitMessage(command: string): string | undefined {
  const m = COMMIT_MSG.exec(command);
  if (!m) return undefined;
  const msg = m[2] ?? m[3];
  if (msg === undefined) return undefined;
  // heredoc 메시지(`-m "$(cat <<'EOF' ...`)는 첫 줄의 실제 제목만 본다.
  if (msg.startsWith("$(")) {
    const lines = msg
      .split("\n")
      .slice(1)
      .map((l) => l.trim())
      .filter((l) => l && !/^EOF/.test(l));
    return lines[0];
  }
  return msg;
}

export function classifyCommand(command: string): CommandFlags {
  const name = commandName(command);
  const forcePush = FORCE_PUSH.test(command);
  const resetHard = RESET_HARD.test(command);
  const rmRf = RM_RF.test(command);
  const commitMessage = extractCommitMessage(command);
  return {
    name,
    test: TEST_RUNNER.test(command),
    forcePush,
    resetHard,
    rmRf,
    otherForce: !forcePush && OTHER_FORCE.test(command),
    sudoBang: SUDO_BANG.test(command),
    commitMessage,
    lowQualityCommit: commitMessage !== undefined && isLowQualityCommitMessage(commitMessage),
  };
}

/** 강제 명령 여부 (J/P forceRatio 분자). */
export function isForceful(flags: CommandFlags): boolean {
  return flags.forcePush || flags.resetHard || flags.rmRf || flags.otherForce;
}
