import { Link } from "../router";
import { CommandLine } from "./CopyButton";

export const INSTALL_COMMAND = "npx llmbti install";
export const LITE_COMMAND = "npx llmbti";

/** "나도 해보기". /start 링크와 설치 명령 복사. */
export function TryItCta({ title = "나도 해보기" }: { title?: string }) {
  return (
    <section className="cta card">
      <h2 className="section-title">{title}</h2>
      <CommandLine command={INSTALL_COMMAND} />
      <Link to="/start" className="btn btn-primary btn-wide">
        테스트 방법 보기
      </Link>
    </section>
  );
}
