import { copyFileSync, cpSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "tsup";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as {
  version: string;
};

/** 레포 루트 skill/ → packages/cli/skill/ (npm 패키지 동봉용, .gitignore 대상). */
function copySkill(): void {
  const src = fileURLToPath(new URL("../../skill/", import.meta.url));
  const dst = fileURLToPath(new URL("./skill/", import.meta.url));
  rmSync(dst, { recursive: true, force: true });
  mkdirSync(dst, { recursive: true });
  cpSync(src, dst, { recursive: true });
}

/** 레포 루트 LICENSE → packages/cli/LICENSE (.gitignore 대상). npm은 패키지 디렉터리의 LICENSE만 자동 동봉한다. */
function copyLicense(): void {
  copyFileSync(
    fileURLToPath(new URL("../../LICENSE", import.meta.url)),
    fileURLToPath(new URL("./LICENSE", import.meta.url)),
  );
}

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node18",
  platform: "node",
  // @llmbti/core를 번들에 포함한다. 런타임 의존성 0.
  noExternal: ["@llmbti/core"],
  banner: { js: "#!/usr/bin/env node" },
  define: { __LLMBTI_VERSION__: JSON.stringify(pkg.version) },
  sourcemap: false,
  clean: true,
  minify: false,
  onSuccess: async () => {
    copySkill();
    copyLicense();
  },
});
