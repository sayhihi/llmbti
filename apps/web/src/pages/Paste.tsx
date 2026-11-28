import { useState } from "react";
import { encodeCompact } from "@llmbti/core";

import { CHAT_PARSE_MESSAGES, parseChatResult } from "../data/chatResult";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { Link, useRouter } from "../router";
import { CHAT_TAB_PATH } from "./Start";

/**
 * 채팅 결과 붙여넣기. 채팅 AI 답변의 결과 코드를 읽어 개인 결과 페이지(/t/TYPE#z=...)로 보낸다.
 * 읽기와 인코딩은 전부 브라우저 안에서 한다. 붙여넣은 글은 어디에도 보내지 않는다.
 */
export function Paste() {
  useDocumentTitle("결과 붙여넣기");
  const { navigate } = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const canReadClipboard =
    typeof navigator !== "undefined" && typeof navigator.clipboard?.readText === "function";

  const submit = (value: string) => {
    const r = parseChatResult(value);
    if (!r.ok) {
      setError(CHAT_PARSE_MESSAGES[r.reason]);
      return;
    }
    setError(null);
    navigate(`/t/${r.payload.type}#z=${encodeCompact(r.payload)}`);
  };

  const pasteFromClipboard = async () => {
    try {
      const value = await navigator.clipboard.readText();
      setText(value);
      submit(value);
    } catch {
      setError("클립보드를 읽지 못했다. 아래 칸을 길게 눌러 붙여넣으면 된다.");
    }
  };

  return (
    <>
      <section className="hero hero-small">
        <p className="eyebrow dim">
          <span className="px">// paste</span>
        </p>
        <h1 className="page-title">결과 붙여넣기</h1>
        <p className="hero-sub">
          채팅 AI가 준 결과 코드를 붙여넣으면 캐릭터와 4축 게이지, 공유 카드가 담긴 내 결과 페이지가
          나온다. 답변 전체를 복사해서 붙여넣어도 된다.
        </p>
      </section>

      <form
        className="section card paste"
        onSubmit={(e) => {
          e.preventDefault();
          submit(text);
        }}
      >
        <label htmlFor="paste-input" className="section-title">
          <span className="px section-eyebrow">// result code</span>
          결과 코드
        </label>
        <textarea
          id="paste-input"
          className="paste-input"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (error) setError(null);
          }}
          placeholder={'{\n  "llmbti": 1,\n  "type": "ENFP",\n  ...\n}'}
          rows={9}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
        />
        {error && (
          <p className="notice" role="alert">
            {error}
          </p>
        )}
        <div className="paste-actions">
          <button type="submit" className="btn btn-primary btn-wide" disabled={text.trim() === ""}>
            내 결과 페이지 만들기
          </button>
          {canReadClipboard && (
            <button
              type="button"
              className="btn btn-wide"
              onClick={() => void pasteFromClipboard()}
            >
              클립보드에서 바로 붙여넣기
            </button>
          )}
        </div>
        <p className="dim small">
          붙여넣은 글은 이 브라우저 안에서만 읽는다. 결과는 링크 안에만 담기고 어디에도 저장되지
          않는다.
        </p>
      </form>

      <p className="center">
        <Link to={CHAT_TAB_PATH} className="link">
          아직 결과가 없다면 채팅 버전 프롬프트부터
        </Link>
      </p>
    </>
  );
}
