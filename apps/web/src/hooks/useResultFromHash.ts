import { useEffect, useState } from "react";
import type { MbtiType } from "@llmbti/core";

import { useRouter } from "../router";
import { hasEncodedResult, resolveResult } from "./resolveResult";
import type { ResultState } from "./resolveResult";

/**
 * /t/:type 에서 location.hash 를 읽어 개인 결과를 꺼낸다. hash 가 바뀌면 다시 읽는다.
 * hash 에 z= 도 r= 도 없으면 비동기 디코딩을 기다리지 않고 바로 none 을 돌려줘서 소개 페이지가 깜빡이지 않게 한다.
 */
export function useResultFromHash(type: MbtiType): ResultState {
  const { hash } = useRouter();
  const [state, setState] = useState<ResultState>(() =>
    hasEncodedResult(hash) ? { status: "loading" } : { status: "none" },
  );

  useEffect(() => {
    let cancelled = false;
    if (!hasEncodedResult(hash)) {
      setState({ status: "none" });
      return;
    }
    setState({ status: "loading" });
    void resolveResult(type, hash).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [type, hash]);

  return state;
}
