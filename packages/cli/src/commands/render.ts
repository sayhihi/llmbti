/**
 * `llmbti render --analysis F --copy F [--no-open] [--base URL]` (SPEC 12장).
 *
 * 검증 → redact → payload → URL → 터미널 출력 → 브라우저. run(라이트 모드)도 같은 renderResult를 쓴다.
 * 터미널 레이아웃: 왼쪽 캐릭터 16줄, 오른쪽에 유형과 별명, roast, 4축 바, evidence 3줄, 커밋 메시지.
 * 그 아래 클립보드/파일 안내 한 줄과 URL 한 줄. `--no-url` 이면 URL 줄은 생략한다 (Claude Code 용).
 */

import { readFileSync } from "node:fs";

import {
  getCharacter,
  isMbtiType,
  URL_WARN_LENGTH,
  type AnalysisOutput,
  type CopyJson,
  type ResultMode,
} from "@llmbti/core";

import { formatProblems, mapCopyStrings, validateCopy } from "../copy/validate";
import { buildPayload, buildUrl, resolveBaseUrl } from "../payload";
import { redact } from "../redact";
import {
  axisBars,
  detectColorMode,
  isColorMode,
  layoutResult,
  renderCharacterAnsi,
  SIDE_BY_SIDE_MIN_WIDTH,
  wrapLines,
  type ColorMode,
} from "../terminal";

/** 캐릭터 32칸 + 간격 2칸. 오른쪽 열은 width - 이 값에 맞춰 줄바꿈한다. */
export const CHARACTER_COLUMN_WIDTH = 34;
export const CHARACTER_LINES = 16;
export const DEFAULT_WIDTH = 80;
const MIN_RIGHT_WIDTH = 20;

export interface RenderIo {
  stdout: (s: string) => void;
  stderr: (s: string) => void;
  isTTY?: boolean;
  columns?: number;
  env?: Record<string, string | undefined>;
  openBrowser?: (url: string) => Promise<boolean>;
  /** 링크를 클립보드에. 없으면 건너뛴다. 기본 clipboard.ts */
  copyToClipboard?: (url: string) => Promise<boolean>;
  /** 링크를 파일에. 쓴 경로 또는 null. 없으면 건너뛴다. 기본 clipboard.ts */
  writeUrlFile?: (url: string) => string | null;
}

export interface RenderOptions {
  mode: ResultMode;
  base?: string | boolean;
  open: boolean;
  /** --open: stdout 이 TTY 가 아니어도(Claude Code 안) 브라우저를 연다. 기본은 TTY 일 때만 */
  forceOpen?: boolean;
  /** --no-url: URL 줄을 찍지 않는다. 클립보드와 파일이 둘 다 실패하면 그래도 찍는다. 기본 true */
  showUrl?: boolean;
  /** 숨은 옵션: 색 모드 강제 (truecolor|256|none) */
  color?: string | boolean;
  /** 숨은 옵션: 터미널 폭 강제 */
  width?: number;
  /** detectColorMode가 --no-color를 찾을 인자 */
  argv?: readonly string[];
}

/** 픽셀 데이터가 아직 없는 유형의 자리. 16줄, 32칸, 가운데 `[TYPE]`. */
export function placeholderCharacter(type: string): string[] {
  const label = `[${type}]`;
  const left = Math.max(0, Math.floor((32 - label.length) / 2));
  const line = " ".repeat(left) + label;
  return Array.from({ length: CHARACTER_LINES }, (_, i) =>
    i === Math.floor(CHARACTER_LINES / 2) ? line : "",
  );
}

/** 오른쪽 열 (줄바꿈 전). roast는 한 줄로 두고 layoutLines가 열 폭에 맞춰 접는다. */
export function rightColumn(analysis: AnalysisOutput, copy: CopyJson): string[] {
  return [
    `${analysis.type}  ${copy.nickname}`,
    "",
    copy.roast,
    "",
    ...axisBars(analysis.scores),
    "",
    ...copy.evidence.map((e) => `- ${e}`),
    "",
    `$ git commit -m "${copy.commitMessage}"`,
  ];
}

export function resolveColorMode(opts: RenderOptions, io: RenderIo): ColorMode {
  if (typeof opts.color === "string" && isColorMode(opts.color)) return opts.color;
  return detectColorMode({
    env: io.env ?? process.env,
    isTTY: io.isTTY ?? Boolean(process.stdout.isTTY),
    argv: opts.argv ?? process.argv,
  });
}

/** 레이아웃 줄 배열 (줄바꿈 없음). 테스트와 renderResult가 같이 쓴다. */
export function layoutLines(
  analysis: AnalysisOutput,
  copy: CopyJson,
  mode: ColorMode,
  width: number,
): string[] {
  const character = getCharacter(analysis.type);
  let characterLines: string[] = [];
  if (mode !== "none") {
    characterLines = character
      ? renderCharacterAnsi(character, { mode })
      : placeholderCharacter(analysis.type);
  }
  const sideBySide = characterLines.length > 0 && width >= SIDE_BY_SIDE_MIN_WIDTH;
  const rightWidth = sideBySide
    ? Math.max(MIN_RIGHT_WIDTH, width - CHARACTER_COLUMN_WIDTH)
    : Math.max(MIN_RIGHT_WIDTH, width);
  const rightLines = wrapLines(rightColumn(analysis, copy), rightWidth);
  return layoutResult({ characterLines, rightLines, width });
}

export interface RenderResult {
  url: string;
  copy: CopyJson;
}

/** 검증된 copy와 analysis로 끝까지 간다. 호출 전에 validateCopy를 통과시켜야 한다. */
export async function renderResult(
  analysis: AnalysisOutput,
  copy: CopyJson,
  opts: RenderOptions,
  io: RenderIo,
): Promise<RenderResult> {
  // 문구는 render 단계에서 redact를 한 번 더 통과한다 (SPEC 7장).
  const safeCopy = mapCopyStrings(copy, (s) => redact(s));
  const payload = buildPayload(analysis, safeCopy, opts.mode);
  const base = resolveBaseUrl(opts.base, io.env ?? process.env);
  const { url, tooLong } = await buildUrl(base, payload);
  if (tooLong) {
    io.stderr(
      `⚠️  결과 URL이 ${URL_WARN_LENGTH}자를 넘는다 (${url.length}자). 일부 메신저가 링크를 자를 수 있다.\n`,
    );
  }

  const colorMode = resolveColorMode(opts, io);
  const width = opts.width ?? io.columns ?? process.stdout.columns ?? DEFAULT_WIDTH;
  const lines = layoutLines(analysis, safeCopy, colorMode, width);
  const copied = io.copyToClipboard ? await io.copyToClipboard(url) : false;
  const filePath = io.writeUrlFile ? io.writeUrlFile(url) : null;
  const tail: string[] = [""];
  if (copied && filePath) tail.push(`📋 링크를 클립보드에 복사했다. 파일: ${filePath}`);
  else if (copied) tail.push("📋 링크를 클립보드에 복사했다");
  else if (filePath) tail.push(`📄 링크를 파일에 써 뒀다: ${filePath}`);
  if (opts.showUrl !== false || (!copied && !filePath)) tail.push("🔗 " + url);
  io.stdout(lines.join("\n") + "\n" + tail.join("\n") + "\n");

  const isTTY = io.isTTY ?? Boolean(process.stdout.isTTY);
  if (opts.open && (isTTY || opts.forceOpen === true) && io.openBrowser) {
    const ok = await io.openBrowser(url);
    if (!ok) io.stderr("⚠️  브라우저를 열지 못했다. 위 URL을 직접 열면 된다.\n");
  }
  return { url, copy: safeCopy };
}

function readJson(path: string, label: string, io: RenderIo): unknown | undefined {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (e) {
    io.stderr(`${label} 파일을 읽을 수 없다: ${path} (${(e as Error).message})\n`);
    return undefined;
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    io.stderr(`${label} 파일이 JSON이 아니다: ${path} (${(e as Error).message})\n`);
    return undefined;
  }
}

/** AnalysisOutput 최소 검사. 전체 스키마는 analyze가 보장하므로 render가 쓰는 필드만 본다. */
export function checkAnalysis(value: unknown): AnalysisOutput | null {
  if (typeof value !== "object" || value === null) return null;
  const a = value as Record<string, unknown>;
  if (a.v !== 1 || !isMbtiType(a.type)) return null;
  if (typeof a.scores !== "object" || a.scores === null) return null;
  if (!Array.isArray(a.badges) || typeof a.stats !== "object" || a.stats === null) return null;
  if (typeof a.periodDays !== "number") return null;
  const ss = a.sampleSize as { prompts?: unknown; shell?: unknown } | undefined;
  if (!ss || typeof ss.prompts !== "number" || typeof ss.shell !== "number") return null;
  return value as AnalysisOutput;
}

export interface RenderCommandOptions extends Omit<RenderOptions, "mode"> {
  analysisPath: string;
  copyPath: string;
}

export async function renderCommand(opts: RenderCommandOptions, io: RenderIo): Promise<number> {
  const rawAnalysis = readJson(opts.analysisPath, "analysis", io);
  if (rawAnalysis === undefined) return 2;
  const analysis = checkAnalysis(rawAnalysis);
  if (!analysis) {
    io.stderr(`analysis 파일이 llmbti analyze --json 출력이 아니다: ${opts.analysisPath}\n`);
    return 2;
  }
  if (analysis.insufficient) {
    io.stderr(
      `아직 덜 컴파일됨. 프롬프트 ${analysis.sampleSize.prompts}개, 셸 명령 ${analysis.sampleSize.shell}개로는 유형이 안 나온다.\n`,
    );
    return 2;
  }

  const rawCopy = readJson(opts.copyPath, "copy", io);
  if (rawCopy === undefined) return 2;
  const checked = validateCopy(rawCopy);
  if (!checked.ok) {
    io.stderr(`copy JSON 검증 실패 (${checked.problems.length}건). 고쳐서 다시 실행:\n`);
    io.stderr(formatProblems(checked.problems));
    return 2;
  }
  await renderResult(analysis, checked.copy, { ...opts, mode: "claude" }, io);
  return 0;
}
