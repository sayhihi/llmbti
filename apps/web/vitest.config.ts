import { defineConfig } from "vitest/config";

// 루트 vitest.config.ts 는 packages/* 만 프로젝트로 묶는다. 웹 테스트는 `pnpm --filter @llmbit/web test` 로 돈다.
// TODO(decision): 루트 projects 에 apps/* 를 넣을지.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
