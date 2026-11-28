/**
 * 담당 AI는 믿어요 (CopyJson.aiLog). "우리 애는요..."로 시작해 "I believe..."로 끝나는 한마디.
 * 끝의 "I believe..."는 떼어서 따로 보여 준다. 일지가 없는 결과(옛 링크)는 호출 측이 섹션을 그리지 않는다.
 */

const BELIEVE_RE = /\s*I\s*believe\s*[.…]*\s*$/i;

export function splitAiLog(text: string): { body: string; believe: boolean } {
  const m = BELIEVE_RE.exec(text);
  if (!m) return { body: text.trim(), believe: false };
  return { body: text.slice(0, m.index).trim(), believe: true };
}

export function AiLog({ text }: { text: string }) {
  const { body, believe } = splitAiLog(text);
  return (
    <section className="section card ai-log">
      <h2 className="section-title">
        <span className="px section-eyebrow">// ai-log</span>
        담당 AI는 믿어요
      </h2>
      {body !== "" && <p className="ai-log-body">{body}</p>}
      {believe && <p className="ai-log-believe">I believe...</p>}
    </section>
  );
}
