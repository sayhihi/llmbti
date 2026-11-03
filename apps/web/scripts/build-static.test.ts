import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { MBTI_TYPES, OG_HEIGHT, OG_WIDTH, SITE_URL, buildStatic, injectMeta } from "./build-static.mjs";

const INDEX = `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <title>llmbti</title>
    <meta name="description" content="기본 설명" />
  </head>
  <body><div id="root"></div></body>
</html>
`;

function pngSize(buf: Buffer): { w: number; h: number } {
  expect(buf.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

describe("build-static", () => {
  let dist: string;
  beforeAll(() => {
    dist = mkdtempSync(join(tmpdir(), "llmbti-static-"));
    writeFileSync(join(dist, "index.html"), INDEX);
    buildStatic({ distDir: dist });
  });
  afterAll(() => rmSync(dist, { recursive: true, force: true }));

  it("16종 HTML 이 있고 각자 자기 og:image 를 가리킨다", () => {
    expect(MBTI_TYPES).toHaveLength(16);
    for (const t of MBTI_TYPES) {
      const html = readFileSync(join(dist, "t", t, "index.html"), "utf8");
      expect(html).toContain(`<meta property="og:image" content="${SITE_URL}/og/${t}.png" />`);
      expect(html).toContain(`<meta property="og:url" content="${SITE_URL}/t/${t}" />`);
      expect(html).toContain(`<meta name="twitter:card" content="summary_large_image" />`);
      expect(html).toMatch(new RegExp(`<title>${t} [^<|]+ \\| llmbti</title>`));
      expect(html).toContain(`<meta property="og:title" content="${t} `);
      expect(html).not.toContain('content="기본 설명"');
      // 원본 골격은 그대로
      expect(html).toContain('<div id="root"></div>');
    }
  });

  it("OG PNG 16장 + default.png 가 1200×630 으로 있다", () => {
    for (const t of MBTI_TYPES) {
      const { w, h } = pngSize(readFileSync(join(dist, "og", `${t}.png`)));
      expect([w, h]).toEqual([OG_WIDTH, OG_HEIGHT]);
    }
    const def = pngSize(readFileSync(join(dist, "og", "default.png")));
    expect([def.w, def.h]).toEqual([OG_WIDTH, OG_HEIGHT]);
  });

  it("start, types, 루트는 자기 제목과 default.png", () => {
    const start = readFileSync(join(dist, "start", "index.html"), "utf8");
    expect(start).toContain("<title>테스트 방법 | llmbti</title>");
    expect(start).toContain(`content="${SITE_URL}/og/default.png"`);
    const types = readFileSync(join(dist, "types", "index.html"), "utf8");
    expect(types).toContain("<title>16종 도감 | llmbti</title>");
    const root = readFileSync(join(dist, "index.html"), "utf8");
    expect(root).toContain("<title>llmbti</title>");
    expect(root).toContain(`content="${SITE_URL}/og/default.png"`);
  });

  it("두 번 돌려도 og 태그가 중복되지 않는다", () => {
    buildStatic({ distDir: dist });
    const html = readFileSync(join(dist, "t", "ENFP", "index.html"), "utf8");
    expect(html.match(/property="og:image"/g)).toHaveLength(1);
    const root = readFileSync(join(dist, "index.html"), "utf8");
    expect(root.match(/property="og:image"/g)).toHaveLength(1);
  });
});

describe("injectMeta", () => {
  it("따옴표와 꺾쇠를 이스케이프한다", () => {
    const html = injectMeta(INDEX, {
      title: 'a "b" <c>',
      description: "d & e",
      image: "https://x/og.png",
      url: "https://x/",
    });
    expect(html).toContain("<title>a &quot;b&quot; &lt;c&gt;</title>");
    expect(html).toContain('content="d &amp; e"');
  });
});
