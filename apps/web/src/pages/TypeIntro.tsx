import type { MbtiType } from "@llmbti/core";

import { PixelCharacter } from "../components/PixelCharacter";
import { RelationCard } from "../components/TypeCard";
import { TryItCta } from "../components/TryItCta";
import { TEMPERAMENT_LABEL, getTypeMeta, temperamentOf } from "../data/typeMeta";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { Link } from "../router";
import { temperamentVar } from "../theme";

interface Props {
  type: MbtiType;
  /** hash 가 있었는데 못 읽은 경우. 소개로 대신 보여 준다고 알린다. */
  fallbackNotice?: boolean;
}

export function TypeIntro({ type, fallbackNotice = false }: Props) {
  const meta = getTypeMeta(type);
  const t = temperamentOf(type);
  useDocumentTitle(`${type} ${meta.nickname}`);

  return (
    <div className="result" style={{ ["--accent" as string]: temperamentVar(t) }}>
      {fallbackNotice && (
        <p className="notice" role="status">
          결과 링크를 읽지 못했다. 링크가 잘렸거나 옛 버전일 수 있다. 대신 {type} 소개를 보여 준다.
        </p>
      )}
      <section className="result-head">
        <PixelCharacter type={type} maxScale={8} className="result-char" />
        <div className="result-head-text">
          <p className="eyebrow dim">
            <span className="px">{t}</span> {TEMPERAMENT_LABEL[t]}
          </p>
          <h1 className="px result-type">{type}</h1>
          <p className="result-nick">{meta.nickname}</p>
          <p className="result-tagline dim">{meta.tagline}</p>
        </div>
      </section>

      <section className="section card">
        <p className="lead">{meta.description}</p>
        <p className="dim small">소품: {meta.prop}</p>
      </section>

      <section className="section">
        <div className="grid grid-2">
          <RelationCard kind="pair" type={meta.pairWith.type} reason={meta.pairWith.reason} />
          <RelationCard kind="clash" type={meta.clashWith.type} reason={meta.clashWith.reason} />
        </div>
      </section>

      <TryItCta title="내 유형도 확인하기" />

      <p className="center">
        <Link to="/types" className="link">
          16종 도감으로
        </Link>
      </p>
    </div>
  );
}
