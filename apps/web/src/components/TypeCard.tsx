import type { MbtiType } from "@llmbit/core";
import type { ReactNode } from "react";

import { getTypeMeta, temperamentOf } from "../data/typeMeta";
import { Link } from "../router";
import { temperamentVar } from "../theme";
import { PixelCharacter } from "./PixelCharacter";

interface Props {
  type: MbtiType;
  /** 카드 아래 한 줄. 없으면 tagline */
  note?: string;
  children?: ReactNode;
}

/** 도감과 랜딩 예시에 같이 쓰는 유형 카드. 전체가 /t/{TYPE} 링크다. */
export function TypeCard({ type, note, children }: Props) {
  const meta = getTypeMeta(type);
  const t = temperamentOf(type);
  return (
    <Link
      to={`/t/${type}`}
      className="type-card"
      aria-label={`${type} ${meta.nickname}`}
      style={{ ["--accent" as string]: temperamentVar(t) }}
    >
      <div className="type-card-body">
        <PixelCharacter type={type} maxScale={4} className="type-card-char" />
        <div className="type-card-text">
          <span className="px type-card-type">{type}</span>
          <strong className="type-card-nick">{meta.nickname}</strong>
          <span className="type-card-note dim">{note ?? meta.tagline}</span>
        </div>
      </div>
      {children}
    </Link>
  );
}

/** 페어 또는 상극 카드 */
export function RelationCard({
  kind,
  type,
  reason,
}: {
  kind: "pair" | "clash";
  type: MbtiType;
  reason: string;
}) {
  const meta = getTypeMeta(type);
  const t = temperamentOf(type);
  return (
    <Link
      to={`/t/${type}`}
      className={kind === "pair" ? "relation-card pair" : "relation-card clash"}
      style={{ ["--accent" as string]: temperamentVar(t) }}
    >
      <span className="relation-kind dim">{kind === "pair" ? "페어 궁합" : "상극"}</span>
      <div className="relation-main">
        <PixelCharacter type={type} maxScale={4} className="relation-char" />
        <div>
          <span className="px relation-type">{type}</span>
          <strong className="relation-nick">{meta.nickname}</strong>
        </div>
      </div>
      <p className="relation-reason">{reason}</p>
    </Link>
  );
}
