import { MBTI_TYPES, URL_WARN_LENGTH } from "@llmbit/core";

/**
 * M0 placeholder. 라우팅(/, /start, /t/{TYPE}, /types)과 결과 렌더링은 M2에서 웹 에이전트가 만든다.
 */
export function App() {
  return (
    <main className="terminal">
      <pre className="prompt">
        <span className="dim">$ </span>npx llmbit
      </pre>
      <h1 className="logo">llmbit</h1>
      <p className="tagline">
        <span className="dim">&gt; </span>typeof me
      </p>
      <p className="status">
        <span className="dim">// </span>M0: 빌드 중. 유형 {MBTI_TYPES.length}종, URL 경고 기준{" "}
        {URL_WARN_LENGTH}자
      </p>
      <span className="cursor" aria-hidden="true" />
    </main>
  );
}
