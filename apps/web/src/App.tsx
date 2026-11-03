import { Layout } from "./components/Layout";
import { Home } from "./pages/Home";
import { NotFound } from "./pages/NotFound";
import { Start } from "./pages/Start";
import { TypePage } from "./pages/TypePage";
import { Types } from "./pages/Types";
import { matchPath, useRouter } from "./router";

/**
 * 경로 4개 (SPEC 13장). 서버 쪽 rewrite 는 vercel.json 에 있다.
 *   /           랜딩
 *   /start      테스트 방법
 *   /t/:type    공유 페이지 (hash 있으면 결과, 없으면 소개)
 *   /types      16종 도감
 */
export function App() {
  const { path } = useRouter();
  return <Layout>{route(path)}</Layout>;
}

function route(path: string) {
  if (path === "/") return <Home />;
  if (path === "/start") return <Start />;
  if (path === "/types") return <Types />;
  const t = matchPath("/t/:type", path);
  if (t?.type) return <TypePage key={t.type} param={t.type} />;
  return <NotFound />;
}
