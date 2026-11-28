import { useEffect, useState } from "react";
import { encodeCompact } from "@llmbti/core";

import { CHAT_PARSE_MESSAGES, parseChatLinkHash } from "../data/chatResult";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { Link, useRouter } from "../router";

/**
 * 채팅 링크 `/c#j=...`. 채팅 AI가 코드 실행으로 만든 링크를 풀어서 개인 결과 페이지(/t/TYPE#z=...)로 바로 보낸다.
 * hash 는 서버로 가지 않으므로 결과는 이 브라우저 안에서만 읽힌다. 못 읽으면 붙여넣기로 안내한다.
 */
export function ChatLink() {
  useDocumentTitle("결과 여는 중");
  const { hash, navigate } = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const r = parseChatLinkHash(hash);
    if (r.ok) navigate(`/t/${r.payload.type}#z=${encodeCompact(r.payload)}`, { replace: true });
    else setError(CHAT_PARSE_MESSAGES[r.reason]);
  }, [hash, navigate]);

  return (
    <section className="hero hero-small">
      <p className="eyebrow dim">
        <span className="px">// open</span>
      </p>
      <h1 className="page-title">{error ? "링크를 못 열었다" : "결과 여는 중"}</h1>
      {error && (
        <>
          <p className="notice">{error}</p>
          <Link to="/paste" className="btn btn-primary btn-wide">
            결과 붙여넣기
          </Link>
        </>
      )}
    </section>
  );
}
