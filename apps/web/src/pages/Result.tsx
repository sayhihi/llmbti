import { AXES } from "@llmbti/core";
import type { ChatInfo, ResultPayload } from "@llmbti/core";

import { AxisGauges, isBorderline } from "../components/AxisGauges";
import { Badges } from "../components/Badges";
import { Handover } from "../components/Handover";
import { PixelCharacter } from "../components/PixelCharacter";
import { ShareRow } from "../components/ShareRow";
import { RelationCard } from "../components/TypeCard";
import { TryItCta } from "../components/TryItCta";
import {
  TEMPERAMENT_LABEL,
  chatRelations,
  getTypeMeta,
  resolvePairWith,
  temperamentOf,
} from "../data/typeMeta";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { Link } from "../router";
import { temperamentVar } from "../theme";

/**
 * 개인 결과 페이지. 섹션 순서는 SPEC 13장 "공유 페이지 구성" 그대로.
 * 1 캐릭터 + 유형 + 별명, 2 roast, 2-1 나를 이을 후임 AI에게(있을 때만), 3 4축 게이지, 4 evidence + 배지, 5 커밋 메시지,
 * 6 페어 카드, 7 공유, 8 나도 해보기
 */
export function Result({ payload }: { payload: ResultPayload }) {
  const { type, copy, scores, badges, stats, mode, periodDays, sampleSize } = payload;
  const meta = getTypeMeta(type);
  const isChat = mode === "chat";
  // 채팅 판정이라도 대화 기록이 개발 이야기 위주면 CLI 와 같은 개발자 문구를 쓴다
  const plain = isChat && payload.chat?.audience !== "dev";
  // 채팅 결과는 궁합 카드 두 장 모두 비개발자 문구를 쓴다
  const relations = plain
    ? chatRelations(type, copy.pairWith)
    : { pair: resolvePairWith(type, copy.pairWith), clash: meta.clashWith };
  const pairWith = relations.pair;
  const t = temperamentOf(type);
  const borderline = AXES.filter((a) => isBorderline(scores[a]));
  const nickname = copy.nickname || meta.nickname;
  useDocumentTitle(`${type} ${nickname}`);

  return (
    <div className="result" style={{ ["--accent" as string]: temperamentVar(t) }}>
      <section className="result-head">
        <PixelCharacter type={type} maxScale={8} className="result-char" />
        <div className="result-head-text">
          <p className="eyebrow dim">
            <span className="px">{t}</span> {TEMPERAMENT_LABEL[t]}
            {isChat && <span className="tag">채팅</span>}
          </p>
          <h1 className="px result-type">{type}</h1>
          <p className="result-nick">{nickname}</p>
          <p className="result-tagline dim">{plain ? meta.chatTagline : meta.tagline}</p>
          <p className="result-meta dim small">
            {isChat
              ? chatMetaLine(payload.chat)
              : `최근 ${periodDays}일, 프롬프트 ${sampleSize.prompts}개, 셸 명령 ${sampleSize.shell}개`}
          </p>
        </div>
      </section>

      {copy.roast && (
        <section className="section card roast">
          <h2 className="section-title">
            <span className="px section-eyebrow">// roast</span>
          </h2>
          <p className="lead">{copy.roast}</p>
        </section>
      )}

      {copy.handover && <Handover handover={copy.handover} />}

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

      {(copy.evidence.length > 0 || badges.length > 0) && (
        <section className="section card">
          <h2 className="section-title">
            <span className="px section-eyebrow">// evidence</span>
            근거
          </h2>
          {copy.evidence.length > 0 && (
            <ol className="evidence">
              {copy.evidence.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ol>
          )}
          <Badges badges={badges} stats={stats} />
        </section>
      )}

      {copy.commitMessage &&
        (plain ? (
          <section className="section card">
            <h2 className="section-title">
              <span className="px section-eyebrow">// status</span>
              오늘의 상태메시지
            </h2>
            <p className="status-msg">{copy.commitMessage}</p>
          </section>
        ) : (
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
        ))}

      <section className="section">
        <div className="grid grid-2">
          <RelationCard
            kind="pair"
            type={pairWith.type}
            reason={pairWith.reason}
            label={plain ? "같이 하면 편한 사이" : undefined}
          />
          <RelationCard
            kind="clash"
            type={relations.clash.type}
            reason={relations.clash.reason}
            label={plain ? "같이 하면 속 터지는 사이" : undefined}
          />
        </div>
      </section>

      <section className="section card share">
        <h2 className="section-title">
          <span className="px section-eyebrow">// share</span>
          공유
        </h2>
        <ShareRow type={type} nickname={nickname} roast={copy.roast} scores={scores} />
      </section>

      {isChat && (
        <section className="section card upsell-cta">
          <h2 className="section-title">진짜 기록으로 보면 더 맵다</h2>
          <p className="dim">
            이 결과는 채팅 AI가 기억과 대화로 추정한 것이다. Claude Code를 쓰면 실제 프롬프트 로그를
            세어서 숫자로 놀린다.
          </p>
          <Link to="/start" className="btn btn-primary">
            Claude Code 버전 보기
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

const CONFIDENCE_LABEL: Record<NonNullable<ChatInfo["confidence"]>, string> = {
  high: "높음",
  mid: "보통",
  low: "낮음",
};

/** chat 모드 헤더 아래 한 줄. 기간과 표본 대신 판정 방식과 신뢰도를 보여 준다. */
export function chatMetaLine(chat: ChatInfo | undefined): string {
  if (chat?.method === "survey") return "채팅 AI, 12문항 설문 판정";
  const who = chat?.audience === "dev" ? "개발자 " : "";
  if (chat?.confidence) {
    return `채팅 AI, ${who}기록 판정, 신뢰도 ${CONFIDENCE_LABEL[chat.confidence]}`;
  }
  return `채팅 AI, ${who}기록 판정`;
}
