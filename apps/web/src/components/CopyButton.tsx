import { useEffect, useRef, useState } from "react";

interface Props {
  text: string;
  /** 버튼 글자. 기본 "복사" */
  label?: string;
  doneLabel?: string;
  className?: string;
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 아래 fallback 으로
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function CopyButton({ text, label = "복사", doneLabel = "복사됨", className }: Props) {
  const [state, setState] = useState<"idle" | "done" | "fail">("idle");
  const timer = useRef<number>(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const onClick = async () => {
    const ok = await copyText(text);
    setState(ok ? "done" : "fail");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState("idle"), 1800);
  };

  return (
    <button
      type="button"
      className={["btn", className].filter(Boolean).join(" ")}
      onClick={onClick}
    >
      {state === "done" ? doneLabel : state === "fail" ? "복사 실패" : label}
    </button>
  );
}

/** 명령어 한 줄 + 복사 버튼 */
export function CommandLine({ command }: { command: string }) {
  return (
    <div className="cmd">
      <code className="cmd-text">
        <span className="dim">$ </span>
        {command}
      </code>
      <CopyButton text={command} className="btn-small" />
    </div>
  );
}
