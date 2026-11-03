import { useEffect, useState } from "react";

/** 프롬프트 줄들을 차례로 치고, 마지막에 출력이 찍힌다. */
const PROMPTS = ["$ npx llmbti install", "> /llmbti"];
const OUTPUT = "ENFP  // 브랜치 23개, 머지 0개";
const CHAR_MS = 55;
const PAUSE_MS = 500;

/**
 * 슬로건 타이핑. 설치 명령, 슬래시 명령 순으로 치고 잠깐 멈춘 뒤 결과가 찍힌다.
 * prefers-reduced-motion 이면 애니메이션 없이 완성 상태를 바로 보여 준다.
 */
export function TypingLine() {
  // 지금까지 친 글자 수를 줄별로 (프롬프트 줄들 + 출력 줄)
  const [typed, setTyped] = useState<number[]>(() => PROMPTS.map(() => 0).concat(0));
  const [done, setDone] = useState(false);

  useEffect(() => {
    const lines = [...PROMPTS, OUTPUT].map((l) => [...l]);
    const finish = () => {
      setTyped(lines.map((l) => l.length));
      setDone(true);
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finish();
      return;
    }
    let line = 0;
    let i = 0;
    let timer = 0;
    const tick = () => {
      i += 1;
      // React 가 updater 를 나중에 돌리므로 지금 값을 잡아 둔다 (line, i 는 아래서 바뀐다)
      const li = line;
      const ci = i;
      setTyped((prev) => prev.map((n, idx) => (idx === li ? ci : n)));
      const isOutput = line === lines.length - 1;
      if (i < lines[line]!.length) {
        timer = window.setTimeout(tick, isOutput ? CHAR_MS * 0.6 : CHAR_MS);
      } else if (!isOutput) {
        line += 1;
        i = 0;
        timer = window.setTimeout(tick, PAUSE_MS);
      } else {
        setDone(true);
      }
    };
    timer = window.setTimeout(tick, 400);
    return () => window.clearTimeout(timer);
  }, []);

  const outputLen = typed[PROMPTS.length] ?? 0;
  const output = [...OUTPUT].slice(0, outputLen).join("");
  const showOutput = outputLen > 0;
  // 커서는 지금 치고 있는 줄 끝에만
  const activeLine = typed.findIndex((n, idx) => n < [...PROMPTS, OUTPUT][idx]!.length);
  const cursorAt = done ? -1 : activeLine === -1 ? PROMPTS.length : activeLine;

  return (
    <pre className="typing" aria-label={`${PROMPTS.join(" ")} ${OUTPUT}`}>
      {PROMPTS.map((p, idx) => {
        const shown = [...p].slice(0, typed[idx] ?? 0).join("");
        if (idx > 0 && (typed[idx] ?? 0) === 0 && cursorAt !== idx) return null;
        return (
          <span key={p} className="typing-prompt">
            {idx > 0 && "\n"}
            {shown}
            {cursorAt === idx && <span className="cursor" aria-hidden="true" />}
          </span>
        );
      })}
      {showOutput && (
        <span className="typing-output">
          {"\n"}
          <span className="typing-type">{output.slice(0, 6)}</span>
          <span className="dim">{output.slice(6)}</span>
          {!done && <span className="cursor" aria-hidden="true" />}
        </span>
      )}
      {done && <span className="cursor cursor-idle" aria-hidden="true" />}
    </pre>
  );
}
