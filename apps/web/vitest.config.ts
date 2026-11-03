import { defineConfig } from "vitest/config";

// 루트 vitest.config.ts 가 apps/* 도 프로젝트로 묶으므로 `pnpm test` 에 포함된다.
// scripts/ 의 빌드 스크립트 테스트도 같이 돈다.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
  },
});
