/**
 * 아주 작은 path 라우터. 의존성을 하나라도 덜 들이려고 react-router 대신 직접 만들었다.
 * history.pushState + popstate + hashchange 만 다룬다. vercel.json 의 rewrite 가 서버 쪽 경로를 index.html 로 보낸다.
 *
 * TODO(decision): 페이지가 더 늘어나거나 중첩 라우트가 필요해지면 react-router-dom 으로 바꾼다.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { CSSProperties, MouseEvent, PropsWithChildren, ReactNode } from "react";

export interface Location {
  path: string;
  hash: string;
}

interface RouterValue extends Location {
  navigate: (to: string, opts?: { replace?: boolean }) => void;
}

const RouterContext = createContext<RouterValue | null>(null);

function readLocation(): Location {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  return { path, hash: window.location.hash };
}

export function Router({ children }: PropsWithChildren) {
  const [loc, setLoc] = useState<Location>(readLocation);

  useEffect(() => {
    const sync = () => setLoc(readLocation());
    window.addEventListener("popstate", sync);
    window.addEventListener("hashchange", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("hashchange", sync);
    };
  }, []);

  const navigate = useCallback((to: string, opts?: { replace?: boolean }) => {
    if (opts?.replace) window.history.replaceState(null, "", to);
    else window.history.pushState(null, "", to);
    setLoc(readLocation());
    window.scrollTo({ top: 0 });
  }, []);

  const value = useMemo(() => ({ ...loc, navigate }), [loc, navigate]);
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter(): RouterValue {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error("useRouter must be used inside <Router>");
  return ctx;
}

/** `/t/:type` 처럼 세그먼트 하나짜리 패턴만 지원한다. */
export function matchPath(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split("/").filter(Boolean);
  const s = path.split("/").filter(Boolean);
  if (p.length !== s.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    const seg = p[i] ?? "";
    const val = s[i] ?? "";
    if (seg.startsWith(":")) params[seg.slice(1)] = decodeURIComponent(val);
    else if (seg !== val) return null;
  }
  return params;
}

interface LinkProps {
  to: string;
  className?: string;
  children: ReactNode;
  "aria-label"?: string;
  title?: string;
  style?: CSSProperties;
}

export function Link({ to, className, children, title, style, ...rest }: LinkProps) {
  const { navigate } = useRouter();
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(to);
  };
  return (
    <a
      href={to}
      className={className}
      title={title}
      style={style}
      aria-label={rest["aria-label"]}
      onClick={onClick}
    >
      {children}
    </a>
  );
}
