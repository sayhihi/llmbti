import { existsSync } from "node:fs";
import { extname, join } from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import type { Plugin } from "vite";

/**
 * `vite preview` 에서 Vercel 의 filesystem 처리처럼 `/t/ENFP` → `dist/t/ENFP/index.html` 을 먼저 찾는다.
 * (vite 기본은 `/t/ENFP.html` 만 보고 없으면 SPA fallback 으로 보낸다.) 빌드 산출물 확인용. 프로덕션에는 영향 없음.
 */
function staticDirIndex(outDir: string): Plugin {
  return {
    name: "llmbti-static-dir-index",
    configurePreviewServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = req.url ?? "/";
        const path = url.split("?")[0] ?? "/";
        if (!extname(path)) {
          const clean = path.replace(/\/+$/, "");
          if (clean && existsSync(join(outDir, clean, "index.html"))) {
            req.url = `${clean}/index.html${url.slice(path.length)}`;
          }
        }
        next();
      });
    },
  };
}

export default defineConfig(({ command }) => ({
  plugins: [react(), ...(command === "serve" ? [staticDirIndex(join(__dirname, "dist"))] : [])],
  build: {
    outDir: "dist",
    sourcemap: false,
  },
}));
