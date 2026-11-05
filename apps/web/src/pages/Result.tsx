import { AXES } from "@llmbti/core";
import type { ResultPayload } from "@llmbti/core";

import { AxisGauges, isBorderline } from "../components/AxisGauges";
import { Badges } from "../components/Badges";
import { PixelCharacter } from "../components/PixelCharacter";
import { ShareRow } from "../components/ShareRow";
import { RelationCard } from "../components/TypeCard";
import { TryItCta } from "../components/TryItCta";
import { TEMPERAMENT_LABEL, getTypeMeta, resolvePairWith, temperamentOf } from "../data/typeMeta";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { Link } from "../router";
import { temperamentVar } from "../theme";

/**
 * 개인 결과 페이지. 섹션 순서는 SPEC 13장 "공유 페이지 구성" 그대로.
 * 1 캐릭터 + 유형 + 별명, 2 roast, 3 4축 게이지, 4 evidence + 배지, 5 커밋 메시지,
 * 6 페어 카드, 7 공유, 8 나도 해보기
 */
export function Result({ payload }: { payload: ResultPayload }) {
  const { type, copy, scores, badges, stats, mode, periodDays, sampleSize } = payload;
  const meta = getTypeMeta(type);
  const pairWith = resolvePairWith(type, copy.pairWith);
  const t = temperamentOf(type);
  const borderline = AXES.filter((a) => isBorderline(scores[a]));
  useDocumentTitle(`${type} ${copy.nickname}`);

  return (
    <div className="result" style={{ ["--accent" as string]: temperamentVar(t) }}>
      <section className="result-head">
        <PixelCharacter type={type} maxScale={8} className="result-char" />
        <div className="result-head-text">
          <p className="eyebrow dim">
            <span className="px">{t}</span> {TEMPERAMENT_LABEL[t]}
            {mode === "lite" && <span className="tag">라이트</span>}
          </p>
          <h1 className="px result-type">{type}</h1>
          <p className="result-nick">{copy.nickname}</p>
          <p className="result-tagline dim">{meta.tagline}</p>
          <p className="result-meta dim small">
            최근 {periodDays}일, 프롬프트 {sampleSize.prompts}개, 셸 명령 {sampleSize.shell}개
          </p>
        </div>
      </section>

      <section className="section card roast">
        <h2 className="section-title">
          <span className="px section-eyebrow">// roast</span>
        </h2>
        <p className="lead">{copy.roast}</p>
      </section>

      <section className="section card">
        <h2 className="section-title">
          <span className="px section-eyebrow">// axes</span>
          4축 점수
        </h2>
        <AxisGauges scores={scores} why={payload.why} />
        {borderline.length > 0 && (
          <p className="dim small">
            {borderline.join(", ")} 축은 5점 안쪽이라 경계형이다. 오늘 기분 따라 반대쪽으로 넘어갈
            수 있다.
          </p>
        )}
      </section>

      <section className="section card">
        <h2 className="section-title">
          <span className="px section-eyebrow">// evidence</span>
          근거
        </h2>
        <ol className="evidence">
          {copy.evidence.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ol>
        <Badges badges={badges} stats={stats} />
      </section>

      <section className="section card">
        <h2 className="section-title">
          <span className="px section-eyebrow">// commit</span>
          오늘의 커밋 메시지
        </h2>
        <pre className="code-block commit">
          <span className="dim">$ git commit -m </span>
          <span className="commit-msg">"{copy.commitMessage}"</span>
        </pre>
      </section>

      <section className="section">
        <div className="grid grid-2">
          <RelationCard kind="pair" type={pairWith.type} reason={pairWith.reason} />
          <RelationCard kind="clash" type={meta.clashWith.type} reason={meta.clashWith.reason} />
        </div>
      </section>

      <section className="section card share">
        <h2 className="section-title">
          <span className="px section-eyebrow">// share</span>
          공유
        </h2>
        <ShareRow type={type} nickname={copy.nickname} roast={copy.roast} scores={scores} />
      </section>

      {mode === "lite" && (
        <section className="section card lite-cta">
          <h2 className="section-title">Claude가 쓴 버전은 더 맵다</h2>
          <p className="dim">
            이 결과는 템플릿 문구다. Claude Code에서 <code>/llmbti</code> 을 돌리면 실제 프롬프트를
            보고 디스를 새로 쓴다.
          </p>
          <Link to="/start" className="btn btn-primary">
            Claude 버전 받는 법
          </Link>
        </section>
      )}

      <TryItCta />

      <p className="center">
        <Link to={`/t/${type}`} className="link">
          {type} 유형 소개 보기
        </Link>
        <span className="dim"> / </span>
        <Link to="/types" className="link">
          16종 도감
        </Link>
      </p>
    </div>
  );
}
