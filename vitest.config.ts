import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // 각 패키지를 프로젝트로 묶는다. 패키지에 vitest.config.ts가 있으면 그걸 쓴다.
    projects: ["packages/*"],
    passWithNoTests: true,
  },
});
