import type { MbtiType, Scores } from "@llmbti/core";
import { useEffect, useRef, useState } from "react";

import { getCharacter } from "../pixel/shim";
import { cardFileName, downloadBlob, renderShareCard } from "../share/shareCard";
import { CopyButton } from "./CopyButton";

interface Props {
  type: MbtiType;
  nickname: string;
  roast: string;
  scores: Scores;
}

function canShare(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

/**
 * 공유 줄 (SPEC 13장 7번). 링크 복사, Web Share (지원 브라우저만), 카드 PNG 저장.
 * URL 은 hash 까지 포함한 현재 주소다. 결과는 hash 안에만 있으니 이 링크가 곧 결과다.
 */
export function ShareRow({ type, nickname, roast, scores }: Props) {
  const url = typeof window !== "undefined" ? window.location.href : "";
  const [shareOk, setShareOk] = useState(false);
  const [saving, setSaving] = useState<"idle" | "busy" | "fail">("idle");
  const timer = useRef<number>(0);

  useEffect(() => {
    setShareOk(canShare());
    return () => window.clearTimeout(timer.current);
  }, []);

  const onShare = async () => {
    try {
      await navigator.share({ title: `${type} ${nickname} | llmbti`, url: window.location.href });
    } catch {
      // 사용자가 취소했거나 지원 안 함. 조용히 넘어간다.
    }
  };

  const onSave = async () => {
    if (saving === "busy") return;
    setSaving("busy");
    try {
      const blob = await renderShareCard({
        type,
        nickname,
        roast,
        scores,
        character: getCharacter(type),
      });
      downloadBlob(blob, cardFileName(type));
      setSaving("idle");
    } catch {
      setSaving("fail");
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setSaving("idle"), 1800);
    }
  };

  return (
    <div className="share-row">
      <CopyButton text={url} label="링크 복사" doneLabel="링크 복사됨" className="btn-primary" />
      {shareOk && (
        <button type="button" className="btn" onClick={onShare}>
          공유하기
        </button>
      )}
      <button type="button" className="btn" onClick={onSave} disabled={saving === "busy"}>
        {saving === "busy" ? "만드는 중" : saving === "fail" ? "저장 실패" : "카드 저장"}
      </button>
    </div>
  );
}
