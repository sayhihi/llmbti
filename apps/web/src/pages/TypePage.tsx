import type { MbtiType } from "@llmbti/core";

import { parseType } from "../data/typeMeta";
import { useResultFromHash } from "../hooks/useResultFromHash";
import { NotFound } from "./NotFound";
import { Result } from "./Result";
import { TypeIntro } from "./TypeIntro";

/**
 * /t/:type
 * hash 에 z= (compact) 나 r= (legacy) 이 있고 읽히면 개인 결과, 없거나 깨졌거나 버전이 다르면 유형 소개 (SPEC 9장 fallback).
 */
export function TypePage({ param }: { param: string }) {
  const type = parseType(param);
  if (!type) return <NotFound what={param.toUpperCase()} />;
  return <TypeRoute type={type} />;
}

function TypeRoute({ type }: { type: MbtiType }) {
  const state = useResultFromHash(type);
  if (state.status === "loading") {
    return (
      <section className="hero hero-small">
        <p className="dim">
          <span className="cursor" aria-hidden="true" /> 결과를 읽는 중
        </p>
      </section>
    );
  }
  if (state.status === "result") return <Result payload={state.payload} />;
  return <TypeIntro type={type} fallbackNotice={state.status === "invalid"} />;
}
