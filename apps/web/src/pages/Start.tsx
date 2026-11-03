import { CommandLine } from "../components/CopyButton";
import { INSTALL_COMMAND, LITE_COMMAND } from "../components/TryItCta";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { Link } from "../router";

export function Start() {
  useDocumentTitle("테스트 방법");
  return (
    <>
      <section className="hero hero-small">
        <p className="eyebrow dim">
          <span className="px">// start</span>
        </p>
        <h1 className="page-title">테스트 방법</h1>
        <p className="hero-sub">
          Claude Code를 쓰고 있다면 4단계. 터미널 한 줄, 슬래시 명령 한 줄, 동의 한 번, 링크 한 번.
        </p>
      </section>

      <ol className="steps">
        <li className="step card">
          <span className="px step-no">1</span>
          <div className="step-body">
            <h2 className="step-title">스킬 설치</h2>
            <p className="dim">
              <code>~/.claude/skills/llmbti/</code> 에 스킬을 복사한다. 전역 설치 없이 npx로 돈다.
            </p>
            <CommandLine command={INSTALL_COMMAND} />
          </div>
        </li>
        <li className="step card">
          <span className="px step-no">2</span>
          <div className="step-body">
            <h2 className="step-title">Claude Code에서 실행</h2>
            <p className="dim">Claude Code 세션을 열고 슬래시 명령을 친다.</p>
            <CommandLine command="/llmbti" />
            <p className="dim small">
              analyze 스크립트가 로그를 집계하고 점수와 유형을 정한다. Claude는 그 숫자를 보고
              디스를 쓴다.
            </p>
          </div>
        </li>
        <li className="step card">
          <span className="px step-no">3</span>
          <div className="step-body">
            <h2 className="step-title">셸 히스토리 읽기 동의</h2>
            <p className="dim">
              <code>~/.zsh_history</code> 나 <code>~/.bash_history</code> 를 읽어도 되는지 물어본다.
              --force 횟수, rm -rf 횟수 같은 재미 통계가 여기서 나온다. 거절하면 Claude Code
              로그만으로 계산한다.
            </p>
          </div>
        </li>
        <li className="step card">
          <span className="px step-no">4</span>
          <div className="step-body">
            <h2 className="step-title">결과 URL 열기</h2>
            <p className="dim">
              터미널에 픽셀 캐릭터와 요약, 결과 링크가 뜬다. 브라우저가 자동으로 열리고 안 열리면
              링크를 붙여 넣으면 된다. 그 링크가 공유용이다.
            </p>
            <pre className="code-block">
              <span className="dim">https://llmbti.vercel.app</span>/t/ENFP
              <span className="dim">#r=...</span>
            </pre>
          </div>
        </li>
      </ol>

      <section className="section card">
        <h2 className="section-title">
          <span className="px section-eyebrow">// lite</span>
          Claude 없이 라이트 모드
        </h2>
        <p className="dim">
          Claude Code를 안 쓰면 이것만 치면 된다. 셸 히스토리로 점수를 내고 문구는 유형별 템플릿에서
          고른다. 결과 페이지는 똑같이 나온다.
        </p>
        <CommandLine command={LITE_COMMAND} />
        <p className="dim small">
          Claude가 쓴 버전은 더 맵다. 라이트 결과 페이지에서도 다시 안내한다.
        </p>
      </section>

      <p className="center">
        <Link to="/types" className="link">
          16종 도감 먼저 구경하기
        </Link>
      </p>
    </>
  );
}
