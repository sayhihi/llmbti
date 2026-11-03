import type { PropsWithChildren } from "react";

import { Link, useRouter } from "../router";

export function Layout({ children }: PropsWithChildren) {
  const { path } = useRouter();
  const nav = (to: string) => (path === to ? "nav-link active" : "nav-link");
  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="brand" aria-label="llmbti 홈">
          <span className="px">llmbti</span>
        </Link>
        <nav className="nav">
          <Link to="/start" className={nav("/start")}>
            테스트 방법
          </Link>
          <Link to="/types" className={nav("/types")}>
            도감
          </Link>
        </nav>
      </header>
      <main className="page">{children}</main>
      <footer className="footer">
        <p>
          <span className="dim">$ </span>npx llmbti
        </p>
        <p className="dim">
          서버 없음. 결과는 URL 안에만 있고 어디에도 저장되지 않는다.
          {/* TODO(decision): SPEC 16장 3번, Claude 마스코트 크레딧 문구를 넣을지 */}
        </p>
      </footer>
    </div>
  );
}
