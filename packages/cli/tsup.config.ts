import { readFileSync } from "node:fs";
import { defineConfig } from "tsup";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as {
  version: string;
};

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node18",
  platform: "node",
  // @llmbit/core를 번들에 포함한다. 런타임 의존성 0.
  noExternal: ["@llmbit/core"],
  banner: { js: "#!/usr/bin/env node" },
  define: { __LLMBIT_VERSION__: JSON.stringify(pkg.version) },
  sourcemap: false,
  clean: true,
  minify: false,
});
