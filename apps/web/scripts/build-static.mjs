#!/usr/bin/env node
// 유형별 정적 HTML 과 OG 이미지를 빌드 타임에 만든다 (SPEC 13장 빌드, M5). 의존성 0.
//
//   vite build && node scripts/build-static.mjs            # apps/web 에서. package.json build 가 부른다
//   node scripts/build-static.mjs --dist dist --site https://llmbit.vercel.app
//
// 산출물 (dist 기준):
//   og/{TYPE}.png        16장, 1200×630. 픽셀 데이터가 있으면 캐릭터, 없으면 기질 색 박스에 글자
//   og/default.png       /, /start, /types 용
//   t/{TYPE}/index.html  index.html 복사본에 title, description, og:*, twitter:card 를 박은 것
//   start/index.html, types/index.html  자기 제목
//   index.html           기본 OG 를 넣어 다시 쓴다 (SPA fallback 도 이걸 받는다)
//
// 텍스트는 내장 5×7 픽셀 폰트로 영문 대문자만 찍는다 (한글 tagline 은 og:description 으로).

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const here = dirname(fileURLToPath(import.meta.url));
/** 모노레포 루트 (apps/web/scripts → ../../..) */
const REPO_ROOT = resolve(here, "../../..");

export const SITE_URL = "https://llmbit.vercel.app";
export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

export const MBTI_TYPES = [
  "INTJ", "INTP", "ENTJ", "ENTP",
  "INFJ", "INFP", "ENFJ", "ENFP",
  "ISTJ", "ISFJ", "ESTJ", "ESFJ",
  "ISTP", "ISFP", "ESTP", "ESFP",
];

/** 기질 → 팔레트 인덱스 [기본, 그림자] (core/types.ts TEMPERAMENT_PALETTE 와 같다) */
const TEMPERAMENT_PALETTE = { SJ: [5, 6], NT: [7, 8], NF: [9, 10], SP: [11, 12] };
const TEMPERAMENT_LABEL = { NT: "ANALYST", NF: "IDEALIST", SJ: "GUARDIAN", SP: "EXPLORER" };

function temperamentOf(type) {
  if (type[1] === "N") return type[2] === "T" ? "NT" : "NF";
  return type[3] === "J" ? "SJ" : "SP";
}

// ---------- 데이터 ----------

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** 팔레트, 캐릭터, typeMeta 를 core 소스에서 읽는다. */
export function loadData(root = REPO_ROOT) {
  const palette = JSON.parse(readFileSync(resolve(root, "packages/core/src/palette.json"), "utf8"));
  const colors = palette.colors.map((c) => (c.hex ? hexToRgb(c.hex) : null));
  const charDir = resolve(root, "packages/core/src/characters");
  const characters = {};
  for (const f of readdirSync(charDir)) {
    if (!f.endsWith(".json") || f.startsWith("_")) continue;
    const c = JSON.parse(readFileSync(join(charDir, f), "utf8"));
    if (MBTI_TYPES.includes(c.id)) characters[c.id] = c;
  }
  const typeMeta = JSON.parse(readFileSync(resolve(root, "packages/core/data/typeMeta.ko.json"), "utf8"));
  for (const t of MBTI_TYPES) {
    if (!typeMeta[t]?.nickname || !typeMeta[t]?.tagline) throw new Error(`typeMeta.ko.json: ${t} 누락`);
  }
  return { colors, characters, typeMeta };
}

// ---------- 캔버스 + PNG (scripts/pixel-preview.mjs 와 같은 방식) ----------

class Canvas {
  constructor(w, h, bg) {
    this.w = w;
    this.h = h;
    this.data = Buffer.alloc(w * h * 3);
    for (let i = 0; i < w * h; i++) this.data.set(bg, i * 3);
  }
  set(x, y, rgb) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.data.set(rgb, (y * this.w + x) * 3);
  }
  rect(x, y, w, h, rgb) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(xx, yy, rgb);
  }
  outline(x, y, w, h, rgb, t = 1) {
    this.rect(x, y, w, t, rgb);
    this.rect(x, y + h - t, w, t, rgb);
    this.rect(x, y, t, h, rgb);
    this.rect(x + w - t, y, t, h, rgb);
  }
  /** 32×32 프레임을 정수 배율로 */
  frame(frame, colors, ox, oy, scale) {
    for (let y = 0; y < frame.length; y++) {
      const line = frame[y];
      for (let x = 0; x < line.length; x++) {
        const ch = line[x];
        if (ch === ".") continue;
        const rgb = colors[parseInt(ch, 16)];
        if (rgb) this.rect(ox + x * scale, oy + y * scale, scale, scale, rgb);
      }
    }
  }
}

const CRC_TABLE = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c;
}
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
export function encodePng(canvas) {
  const { w, h, data } = canvas;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0; // filter: none
    data.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------- 5×7 픽셀 폰트 (대문자, 숫자 일부, 기호) ----------

const GLYPHS = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  ">": ["10000", "01000", "00100", "00010", "00100", "01000", "10000"],
  "?": ["01110", "10001", "00001", "00010", "00100", "00000", "00100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
};

/** 글자 하나 5×7, 간격 1칸. scale 배율. 돌려주는 값은 찍은 너비(px). */
export function drawText(cv, text, x, y, scale, rgb) {
  let cx = x;
  for (const ch of text.toUpperCase()) {
    const g = GLYPHS[ch] ?? GLYPHS["?"];
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 5; c++) {
        if (g[r][c] === "1") cv.rect(cx + c * scale, y + r * scale, scale, scale, rgb);
      }
    }
    cx += 6 * scale;
  }
  return cx - x - scale;
}

export function textWidth(text, scale) {
  return text.length * 6 * scale - scale;
}

// ---------- OG 이미지 ----------

const BG = hexToRgb("#111111"); // palette black
const GRID = hexToRgb("#1b1b1b");

function drawBackground(cv) {
  for (let x = 0; x < cv.w; x += 32) cv.rect(x, 0, 1, cv.h, GRID);
  for (let y = 0; y < cv.h; y += 32) cv.rect(0, y, cv.w, 1, GRID);
}

function drawPlaceholder(cv, type, base, shadow, ox, oy, size) {
  cv.rect(ox, oy, size, size, shadow);
  cv.rect(ox + 12, oy + 12, size - 24, size - 24, base);
  // 점선 테두리
  const dash = 12;
  for (let i = 0; i < size - 48; i += dash * 2) {
    cv.rect(ox + 24 + i, oy + 24, dash, 4, BG);
    cv.rect(ox + 24 + i, oy + size - 28, dash, 4, BG);
    cv.rect(ox + 24, oy + 24 + i, 4, dash, BG);
    cv.rect(ox + size - 28, oy + 24 + i, 4, dash, BG);
  }
  const s = 8;
  const w = textWidth(type, s);
  drawText(cv, type, ox + Math.floor((size - w) / 2), oy + Math.floor((size - 7 * s) / 2), s, BG);
}

/** 유형 하나의 OG. 왼쪽 캐릭터(또는 박스), 오른쪽 기질 라벨, TYPE, 별명 자리 대신 기질 색 줄, 하단 LLMBIT. */
export function renderTypeOg(type, data) {
  const { colors, characters } = data;
  const [bi, si] = TEMPERAMENT_PALETTE[temperamentOf(type)];
  const base = colors[bi];
  const shadow = colors[si];
  const white = colors[2];
  const grey = colors[4];
  const cv = new Canvas(OG_WIDTH, OG_HEIGHT, BG);
  drawBackground(cv);
  cv.rect(0, 0, OG_WIDTH, 12, base);

  // 왼쪽
  const box = { x: 72, y: 80, w: 420, h: 470 };
  const c = characters[type];
  if (c) {
    const scale = Math.floor(Math.min(box.w, box.h) / c.size); // 32 → 13
    const size = c.size * scale;
    const idle = c.anims?.idle?.[0] ?? 0;
    cv.frame(c.frames[idle] ?? c.frames[0], colors, box.x + Math.floor((box.w - size) / 2), box.y + Math.floor((box.h - size) / 2), scale);
  } else {
    const size = 340;
    drawPlaceholder(cv, type, base, shadow, box.x + Math.floor((box.w - size) / 2), box.y + Math.floor((box.h - size) / 2), size);
  }

  // 오른쪽
  const left = 560;
  drawText(cv, "> NPX LLMBIT", left, 118, 4, grey);
  drawText(cv, type, left, 190, 14, base); // 글자 70×98, 4글자 ≈ 322px
  const label = `${temperamentOf(type)} / ${TEMPERAMENT_LABEL[temperamentOf(type)]}`;
  drawText(cv, label, left, 326, 4, white);
  // 별명 자리: 기질 색 막대 (한글은 못 찍는다. og:description 이 tagline 을 들고 간다)
  cv.rect(left, 384, 420, 6, shadow);
  cv.rect(left, 384, 160, 6, base);
  drawText(cv, "DEV MBTI FROM YOUR", left, 420, 4, grey);
  drawText(cv, "PROMPTS AND SHELL", left, 460, 4, grey);

  // 푸터
  const host = "LLMBIT.VERCEL.APP";
  drawText(cv, host, OG_WIDTH - 72 - textWidth(host, 4), OG_HEIGHT - 72, 4, grey);
  return cv;
}

/** 기본 OG: 그려진 캐릭터들을 나란히 + 제목 */
export function renderDefaultOg(data) {
  const { colors, characters } = data;
  const white = colors[2];
  const grey = colors[4];
  const cv = new Canvas(OG_WIDTH, OG_HEIGHT, BG);
  drawBackground(cv);
  // 네 기질 색 띠
  const stripes = ["NT", "NF", "SJ", "SP"].map((t) => colors[TEMPERAMENT_PALETTE[t][0]]);
  stripes.forEach((rgb, i) => cv.rect(i * (OG_WIDTH / 4), 0, OG_WIDTH / 4, 12, rgb));

  const drawn = MBTI_TYPES.filter((t) => characters[t]);
  const scale = 8;
  const size = 32 * scale;
  const gap = 40;
  const totalW = drawn.length * size + (drawn.length - 1) * gap;
  const startX = Math.floor((OG_WIDTH - totalW) / 2);
  drawn.forEach((t, i) => {
    const c = characters[t];
    const idle = c.anims?.idle?.[0] ?? 0;
    cv.frame(c.frames[idle] ?? c.frames[0], colors, startX + i * (size + gap), 70, scale);
  });

  const title = "LLMBIT";
  drawText(cv, title, Math.floor((OG_WIDTH - textWidth(title, 14)) / 2), 372, 14, white);
  const sub = "WHAT IS MY LLMBIT?";
  drawText(cv, sub, Math.floor((OG_WIDTH - textWidth(sub, 5)) / 2), 500, 5, grey);
  const host = "LLMBIT.VERCEL.APP";
  drawText(cv, host, OG_WIDTH - 72 - textWidth(host, 4), OG_HEIGHT - 72, 4, grey);
  return cv;
}

// ---------- HTML ----------

const DEFAULT_DESCRIPTION = "LLM에게 일을 시키는 패턴으로 보는 개발자 MBTI";

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * index.html 에 메타를 박는다. 기존 <title> 과 description 은 바꾸고 og/twitter 는 </head> 앞에 넣는다.
 * 이미 og 태그가 있으면 (두 번 돌린 경우) 먼저 걷어낸다.
 */
export function injectMeta(html, { title, description, image, url }) {
  let out = html.replace(/<!-- og:start -->[\s\S]*?<!-- og:end -->\s*/g, "");
  out = out.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`);
  out = out.replace(
    /<meta name="description" content="[^"]*" \/>/,
    `<meta name="description" content="${escapeHtml(description)}" />`,
  );
  const tags = [
    "<!-- og:start -->",
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="llmbit" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:image" content="${escapeHtml(image)}" />`,
    `<meta property="og:image:width" content="${OG_WIDTH}" />`,
    `<meta property="og:image:height" content="${OG_HEIGHT}" />`,
    `<meta property="og:url" content="${escapeHtml(url)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(image)}" />`,
    "<!-- og:end -->",
  ]
    .map((t) => `    ${t}`)
    .join("\n");
  if (!out.includes("</head>")) throw new Error("index.html 에 </head> 가 없다");
  return out.replace("</head>", `${tags}\n  </head>`);
}

/** 페이지별 메타. 웹 useDocumentTitle 과 같은 제목 규칙 ("{x} | llmbit"). */
export function pageMeta(data, siteUrl = SITE_URL) {
  const pages = [
    {
      path: "",
      title: "llmbit",
      description: DEFAULT_DESCRIPTION,
      image: `${siteUrl}/og/default.png`,
      url: `${siteUrl}/`,
    },
    {
      path: "start",
      title: "테스트 방법 | llmbit",
      description: "npx llmbit install 한 줄, Claude Code 에서 /llmbit 한 줄. 로그는 기기 밖으로 안 나간다.",
      image: `${siteUrl}/og/default.png`,
      url: `${siteUrl}/start`,
    },
    {
      path: "types",
      title: "16종 도감 | llmbit",
      description: "개발자 MBTI 16종. 몸 색은 기질, 눈은 E/I 와 T/F, 머리 위 소품은 별명.",
      image: `${siteUrl}/og/default.png`,
      url: `${siteUrl}/types`,
    },
  ];
  for (const t of MBTI_TYPES) {
    const m = data.typeMeta[t];
    pages.push({
      path: `t/${t}`,
      title: `${t} ${m.nickname} | llmbit`,
      description: m.tagline,
      image: `${siteUrl}/og/${t}.png`,
      url: `${siteUrl}/t/${t}`,
    });
  }
  return pages;
}

// ---------- 실행 ----------

/**
 * dist 에 og/ 와 정적 HTML 을 쓴다. 돌려주는 값은 쓴 파일 경로 목록.
 * @param {{ distDir: string, siteUrl?: string, root?: string, log?: (s: string) => void }} opts
 */
export function buildStatic({ distDir, siteUrl = SITE_URL, root = REPO_ROOT, log = () => {} }) {
  const indexPath = join(distDir, "index.html");
  if (!existsSync(indexPath)) throw new Error(`${indexPath} 가 없다. vite build 먼저.`);
  const data = loadData(root);
  const written = [];

  const ogDir = join(distDir, "og");
  mkdirSync(ogDir, { recursive: true });
  for (const t of MBTI_TYPES) {
    const p = join(ogDir, `${t}.png`);
    writeFileSync(p, encodePng(renderTypeOg(t, data)));
    written.push(p);
  }
  const def = join(ogDir, "default.png");
  writeFileSync(def, encodePng(renderDefaultOg(data)));
  written.push(def);

  // index.html 은 og 가 이미 박힌 복사본이 아니라 원본 기준으로 만든다
  const baseHtml = readFileSync(indexPath, "utf8").replace(/<!-- og:start -->[\s\S]*?<!-- og:end -->\s*/g, "");
  for (const page of pageMeta(data, siteUrl)) {
    const dir = page.path ? join(distDir, page.path) : distDir;
    mkdirSync(dir, { recursive: true });
    const p = join(dir, "index.html");
    writeFileSync(p, injectMeta(baseHtml, page));
    written.push(p);
  }
  log(`build-static: og ${MBTI_TYPES.length + 1}장, html ${written.length - MBTI_TYPES.length - 1}개 → ${distDir}`);
  return written;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  let distDir = resolve(here, "../dist");
  let siteUrl = SITE_URL;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dist") distDir = resolve(args[++i]);
    else if (args[i] === "--site") siteUrl = args[++i];
  }
  buildStatic({ distDir, siteUrl, log: console.log });
}
