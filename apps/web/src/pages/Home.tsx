import { AxisGauges } from "../components/AxisGauges";
import { TypeCard } from "../components/TypeCard";
import { TypingLine } from "../components/TypingLine";
import { WalkStrip } from "../components/WalkStrip";
import { SAMPLE_RESULTS } from "../data/samples";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { Link } from "../router";

export function Home() {
  useDocumentTitle(null);
  return (
    <>
      <section className="hero">
        <h1 className="hero-title">나의 LLM MBTI는 무엇일까?</h1>
        <p className="hero-sub">
          Claude Code에 일을 시키는 말투와 셸 히스토리로 보는 개발자 MBTI.
          <br />
          점수는 스크립트가 계산하고 디스는 Claude가 쓴다.
        </p>
        <TypingLine />
        <div className="hero-actions">
          <Link to="/start" className="btn btn-primary btn-big">
            테스트 시작
          </Link>
          <Link to="/types" className="btn btn-ghost btn-big">
            16종 도감
          </Link>
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">
          <span className="px section-eyebrow">// sample</span>
          이런 결과가 나온다
        </h2>
        <div className="grid grid-3">
          {SAMPLE_RESULTS.map((s) => (
            <TypeCard key={s.type} type={s.type} note={s.evidence}>
              <AxisGauges scores={s.scores} compact />
            </TypeCard>
          ))}
        </div>
        <p className="dim small">예시 점수다. 실제 결과는 본인 로그에서 나온다.</p>
      </section>

      <section className="section card">
        <h2 className="section-title">
          <span className="px section-eyebrow">// how</span>
          어떻게 보는 건데
        </h2>
        <ol className="plain-list">
          <li>
            <strong>E / I</strong> 세션당 턴 수, 물음표 비율, 프롬프트 길이. 대화형인지 독백형인지.
          </li>
          <li>
            <strong>S / N</strong> 파일 경로와 에러 로그를 붙이는지, 구조와 설계 얘기를 하는지.
          </li>
          <li>
            <strong>T / F</strong> "고쳐" 한 마디로 끝내는지, 고마워와 ㅋㅋ를 붙이는지.
          </li>
          <li>
            <strong>J / P</strong> 계획을 세우고 테스트를 돌리는지, --force와 "다시"가 많은지.
          </li>
        </ol>
        <p className="dim small">
          원본 로그는 기기 밖으로 안 나간다. 결과 페이지로 가는 건 유형, 점수, 문구뿐이고 URL 안에만
          실린다.
        </p>
      </section>

      <section className="section walk-section">
        <WalkStrip />
      </section>
    </>
  );
}
