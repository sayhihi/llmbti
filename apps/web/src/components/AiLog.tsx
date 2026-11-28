/**
 * 담당 AI의 업무 일지 (CopyJson.aiLog). "후임에게:" 뒤는 따로 떼서 메모처럼 보여 준다.
 * 일지가 없는 결과(옛 링크, 라이트 모드)는 호출 측이 섹션을 그리지 않는다.
 */

const HANDOFF = "후임에게:";

export function splitAiLog(text: string): { body: string; handoff: string | null } {
  const i = text.indexOf(HANDOFF);
  if (i === -1) return { body: text.trim(), handoff: null };
  const body = text.slice(0, i).trim();
  const handoff = text.slice(i + HANDOFF.length).trim();
  if (handoff === "") return { body: text.trim(), handoff: null };
  return { body, handoff };
}

export function AiLog({ text }: { text: string }) {
  const { body, handoff } = splitAiLog(text);
  return (
    <section className="section card ai-log">
      <h2 className="section-title">
        <span className="px section-eyebrow">// ai-log</span>
        담당 AI의 업무 일지
      </h2>
      {body !== "" && <p className="ai-log-body">{body}</p>}
      {handoff && (
        <p className="ai-log-handoff">
          <span className="ai-log-label">{HANDOFF}</span> {handoff}
        </p>
      )}
    </section>
  );
}
