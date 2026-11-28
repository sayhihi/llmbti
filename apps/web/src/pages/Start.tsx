import { CommandLine, CopyButton } from "../components/CopyButton";
import { INSTALL_COMMAND } from "../components/TryItCta";
import { CHAT_PROMPT } from "../data/chatPrompt";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { Link, useRouter } from "../router";

type Tab = "code" | "chat";

/** 채팅 탭 주소. 결과 페이지의 "나도 해보기"가 여기로 바로 보낸다. */
export const CHAT_TAB_PATH = "/start#chat";

const TABS: readonly { id: Tab; label: string; to: string }[] = [
  { id: "code", label: "CLI 버전", to: "/start" },
  { id: "chat", label: "채팅 버전", to: CHAT_TAB_PATH },
];

export function Start() {
  useDocumentTitle("테스트 방법");
  const { hash, navigate } = useRouter();
  const tab: Tab = hash === "#chat" ? "chat" : "code";

  return (
    <>
      <section className="hero hero-small">
        <p className="eyebrow dim">
          <span className="px">// start</span>
        </p>
        <h1 className="page-title">테스트 방법</h1>
        <p className="hero-sub">
          Claude Code를 쓰면 CLI 버전으로 터미널에서 3단계. 아니라면 채팅 버전으로 프롬프트 하나만
          붙여 넣으면 된다.
        </p>
      </section>

      <div className="tabs" role="tablist" aria-label="테스트 방법 고르기">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            className={tab === t.id ? "tab active" : "tab"}
            onClick={() => navigate(t.to, { replace: true })}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div
        className="tab-panel"
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
      >
        {tab === "code" ? <CodeGuide /> : <ChatGuide />}
      </div>

      <p className="center">
        <Link to="/types" className="link">
          16종 도감 먼저 구경하기
        </Link>
      </p>
    </>
  );
}

function CodeGuide() {
  return (
    <>
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
            <p className="dim small">
              도중에 셸 히스토리를 읽어도 되는지 한 번 물어본다. 거절해도 Claude Code 로그만으로
              계산한다.
            </p>
          </div>
        </li>
        <li className="step card">
          <span className="px step-no">3</span>
          <div className="step-body">
            <h2 className="step-title">결과 URL 열기</h2>
            <p className="dim">
              터미널에 픽셀 캐릭터와 요약, 결과 링크가 뜬다. 브라우저가 자동으로 열리고 안 열리면
              링크를 붙여 넣으면 된다. 그 링크가 공유용이다.
            </p>
            <pre className="code-block">
              <span className="dim">https://llmbti.vercel.app</span>/t/ENFP
              <span className="dim">#z=...</span>
            </pre>
          </div>
        </li>
      </ol>

    </>
  );
}

function ChatGuide() {
  return (
    <ol className="steps">
      <li className="step card">
        <span className="px step-no">1</span>
        <div className="step-body">
          <h2 className="step-title">프롬프트 복사</h2>
          <p className="dim">버튼을 누르면 판정용 프롬프트가 복사된다. 설치할 건 없다.</p>
          <CopyButton
            text={CHAT_PROMPT}
            label="프롬프트 복사하기"
            className="btn-primary btn-wide copy-prompt"
          />
        </div>
      </li>
      <li className="step card">
        <span className="px step-no">2</span>
        <div className="step-body">
          <h2 className="step-title">채팅창에 붙여 넣기</h2>
          <p className="dim">
            ChatGPT나 Claude처럼 평소 쓰는 채팅 AI에 그대로 붙여 넣고 보낸다. AI가 나에 대해
            기억하는 내용으로 바로 결과를 낸다. 기억이 하나도 없을 때만 12문항을 물어본다.
          </p>
        </div>
      </li>
      <li className="step card">
        <span className="px step-no">3</span>
        <div className="step-body">
          <h2 className="step-title">결과 붙여넣기</h2>
          <p className="dim">
            채팅으로 유형과 별명, 한 줄 평, 후임 AI에게 남기는 인수인계가 먼저 나온다. 답변 끝의 결과 코드를
            복사해서 붙여넣기 페이지에 넣으면 캐릭터와 공유 카드가 담긴 내 결과 페이지가 나온다.
          </p>
          <Link to="/paste" className="btn btn-primary btn-wide">
            결과 붙여넣기
          </Link>
          <p className="dim small">
            결과 코드만 고르기 어려우면 답변 전체를 복사해도 된다. 휴대폰 앱에서는 답변을 길게 눌러
            복사하면 된다.
          </p>
        </div>
      </li>
    </ol>
  );
}
