import { CopyButton } from "./CopyButton";

/**
 * 공유 줄. 링크 복사만 M2에서 동작한다.
 * TODO(M5): Web Share API (navigator.share) 연결
 * TODO(M5): 카드 PNG 다운로드 (canvas 1200x630, 클라이언트 생성)
 */
export function ShareRow() {
  const url = typeof window !== "undefined" ? window.location.href : "";
  return (
    <div className="share-row">
      <CopyButton text={url} label="링크 복사" doneLabel="링크 복사됨" className="btn-primary" />
      <button type="button" className="btn" disabled title="M5에서 추가">
        공유하기
      </button>
      <button type="button" className="btn" disabled title="M5에서 추가">
        카드 저장
      </button>
    </div>
  );
}
