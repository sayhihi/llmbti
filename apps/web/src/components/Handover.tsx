import { HANDOVER_CLOSING, HANDOVER_SIGN, HANDOVER_TITLE, handoverLetterLines } from "@llmbti/core";
import type { Handover as HandoverCopy } from "@llmbti/core";

/**
 * 나를 이을 후임 AI에게 (CopyJson.handover). 담당 AI가 후임 AI에게 남기는 편지.
 * 네 항목을 core 의 handoverLetterLines 로 이어 한 줄씩 보여 주고, "부탁한다."와 서명으로 맺는다.
 * 항목이 전부 비면 아무것도 안 그린다.
 */
export function Handover({ handover }: { handover: HandoverCopy }) {
  const lines = handoverLetterLines(handover);
  if (lines.length === 0) return null;
  return (
    <section className="section card handover">
      <h2 className="section-title">
        <span className="px section-eyebrow">// handover</span>
      </h2>
      <div className="letter">
        <p className="letter-to">{HANDOVER_TITLE}.</p>
        <div className="letter-body">
          {lines.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
          <p>{HANDOVER_CLOSING}</p>
        </div>
        <p className="letter-sign">{HANDOVER_SIGN}</p>
      </div>
    </section>
  );
}
