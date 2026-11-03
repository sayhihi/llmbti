import { useEffect, useState } from "react";

const PROMPT = "$ npx llmbti";
const OUTPUT = "ENFP  // 브랜치 23개, 머지 0개";
const CHAR_MS = 55;
const PAUSE_MS = 500;

/**
 * 슬로건 타이핑. 프롬프트를 치고 잠깐 멈춘 뒤 출력이 찍힌다.
 * prefers-reduced-motion 이면 애니메이션 없이 완성 상태를 바로 보여 준다.
 */
export function TypingLine() {
  const [promptLen, setPromptLen] = useState(0);
  const [outputLen, setOutputLen] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPromptLen(PROMPT.length);
      setOutputLen(OUTPUT.length);
      setDone(true);
      return;
    }
    const chars = [...PROMPT];
    const outChars = [...OUTPUT];
    let i = 0;
    let timer = 0;
    const typePrompt = () => {
      i += 1;
      setPromptLen(i);
      if (i < chars.length) timer = window.setTimeout(typePrompt, CHAR_MS);
      else timer = window.setTimeout(typeOutput, PAUSE_MS);
    };
    let j = 0;
    const typeOutput = () => {
      j += 1;
      setOutputLen(j);
      if (j < outChars.length) timer = window.setTimeout(typeOutput, CHAR_MS * 0.6);
      else setDone(true);
    };
    timer = window.setTimeout(typePrompt, 400);
    return () => window.clearTimeout(timer);
  }, []);

  const prompt = [...PROMPT].slice(0, promptLen).join("");
  const output = [...OUTPUT].slice(0, outputLen).join("");
  const showOutput = promptLen >= PROMPT.length && outputLen > 0;

  return (
    <pre className="typing" aria-label={`${PROMPT} ${OUTPUT}`}>
      <span className="typing-prompt">
        {prompt}
        {!showOutput && <span className="cursor" aria-hidden="true" />}
      </span>
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
