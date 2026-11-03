import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { Link } from "../router";

export function NotFound({ what }: { what?: string }) {
  useDocumentTitle("404");
  return (
    <section className="hero hero-small notfound">
      <p className="px notfound-code">404</p>
      <h1 className="page-title">{what ? `${what} 는 없는 유형이다` : "없는 페이지다"}</h1>
      <p className="dim">유형은 16개뿐이다. 네 글자가 맞는지 보거나 도감에서 고르면 된다.</p>
      <div className="hero-actions">
        <Link to="/types" className="btn btn-primary">
          16종 도감
        </Link>
        <Link to="/" className="btn btn-ghost">
          홈으로
        </Link>
      </div>
    </section>
  );
}
