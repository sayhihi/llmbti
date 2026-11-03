/**
 * 테스트 공용 헬퍼. 런타임 코드에서 import 하지 않는다.
 */

import { fileURLToPath } from "node:url";
import { join } from "node:path";

/** 레포 루트의 fixtures/<name> 절대 경로 */
export function fixtureHome(name: string): string {
  return join(fileURLToPath(new URL("../../../fixtures/", import.meta.url)), name);
}

/** fixtures 생성 기준 시각 (fixtures/generate.mjs 참고). 분석은 이 시각 기준 최근 30일. */
export const FIXTURE_NOW = Date.parse("2026-11-01T12:00:00Z");

/** fixtures 는 KST 기준으로 시간대를 잡았다. */
export const FIXTURE_TZ = 540;
