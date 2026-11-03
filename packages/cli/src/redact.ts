/**
 * 시크릿 마스킹 (SPEC 7장). analyze 샘플과 통계 문자열, render의 문구가 모두 이걸 통과한다.
 *
 * 순서가 중요하다: 홈 경로 → URL(userinfo, 쿼리) → 알려진 토큰 패턴 → key=value → 긴 hex/base64 덩어리 → 이메일/전화/IP.
 * 긴 덩어리 규칙을 먼저 돌리면 JWT나 ghp_ 같은 더 구체적인 라벨을 잃는다.
 */

import { homedir } from "node:os";

export interface RedactOptions {
  /** `~`로 바꿀 홈 디렉터리. 기본은 os.homedir() */
  home?: string;
}

interface Rule {
  name: string;
  pattern: RegExp;
  replace: string | ((...args: string[]) => string);
}

/** 알려진 시크릿 패턴. 이름은 테스트와 문서용. */
export const SECRET_RULES: readonly Rule[] = [
  // 비밀키 블록
  {
    name: "privateKey",
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g,
    replace: "[PRIVATE_KEY]",
  },
  // OpenAI / Anthropic 계열 sk-...
  { name: "skToken", pattern: /\bsk-(?:ant-)?[A-Za-z0-9_-]{16,}/g, replace: "[SK_TOKEN]" },
  // Stripe
  { name: "stripe", pattern: /\b[sp]k_(?:live|test)_[A-Za-z0-9]{10,}/g, replace: "[STRIPE_KEY]" },
  // GitHub
  {
    name: "githubToken",
    pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/g,
    replace: "[GITHUB_TOKEN]",
  },
  // Slack
  { name: "slackToken", pattern: /\bxox[abposer]-[A-Za-z0-9-]{10,}/g, replace: "[SLACK_TOKEN]" },
  {
    name: "slackWebhook",
    pattern: /https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/_-]+/g,
    replace: "[SLACK_WEBHOOK]",
  },
  // AWS
  { name: "awsAccessKey", pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, replace: "[AWS_KEY]" },
  // Google API key
  { name: "googleApiKey", pattern: /\bAIza[0-9A-Za-z_-]{30,}/g, replace: "[GOOGLE_KEY]" },
  // npm
  { name: "npmToken", pattern: /\bnpm_[A-Za-z0-9]{30,}/g, replace: "[NPM_TOKEN]" },
  // JWT
  {
    name: "jwt",
    pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g,
    replace: "[JWT]",
  },
  // Bearer 헤더
  {
    name: "bearer",
    pattern: /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{16,}/gi,
    replace: "$1 [TOKEN]",
  },
  // password= / token= / secret= 류. 구분자는 = : 와 공백, 값은 따옴표 유무 모두.
  {
    name: "keyValue",
    pattern:
      /\b(password|passwd|pwd|pass|token|access_token|refresh_token|secret|client_secret|api[_-]?key|apikey|auth|authorization|credential|private[_-]?key)(\s*[=:]\s*)(?:"[^"]*"|'[^']*'|\S+)/gi,
    replace: "$1$2[REDACTED]",
  },
  // 32자 이상 hex 덩어리 (sha, 세션 id 등)
  { name: "longHex", pattern: /\b[0-9a-fA-F]{32,}\b/g, replace: "[HEX]" },
  // 32자 이상 base64 덩어리. 영문과 숫자가 섞여 있고 공백 없는 것만. 숫자가 하나도 없으면 긴 단어로 보고 둔다.
  {
    name: "longBase64",
    pattern:
      /(?<![A-Za-z0-9+/=])(?=[A-Za-z0-9+/=]*\d)(?=[A-Za-z0-9+/=]*[A-Za-z])[A-Za-z0-9+/]{32,}={0,2}(?![A-Za-z0-9+/=])/g,
    replace: "[BASE64]",
  },
  // 이메일
  { name: "email", pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, replace: "[EMAIL]" },
  // 전화번호: 010-1234-5678, +82 10 1234 5678, (02) 123-4567, 555-123-4567
  {
    name: "phone",
    pattern: /(?<![\w.])(?:\+\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-])?\d{3,4}[\s-]\d{4}(?![\w.])/g,
    replace: "[PHONE]",
  },
  // IPv4 (버전 번호처럼 보이는 1.2.3은 제외: 4옥텟만)
  { name: "ipv4", pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, replace: "[IP]" },
];

/** URL의 userinfo와 쿼리스트링을 지운다. `https://user:pw@host/path?x=1` → `https://[USERINFO]@host/path?[QUERY]` */
export function redactUrls(text: string): string {
  return text.replace(
    /\b([a-z][a-z0-9+.-]*):\/\/([^\s"'<>]+)/gi,
    (_m, scheme: string, rest: string) => {
      let r = rest;
      const at = r.indexOf("@");
      const slash = r.indexOf("/");
      if (at !== -1 && (slash === -1 || at < slash)) r = "[USERINFO]@" + r.slice(at + 1);
      const q = r.indexOf("?");
      if (q !== -1) {
        const hash = r.indexOf("#", q);
        r = r.slice(0, q + 1) + "[QUERY]" + (hash !== -1 ? r.slice(hash) : "");
      }
      return `${scheme}://${r}`;
    },
  );
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 홈 디렉터리 경로를 `~`로. 명시된 home 외에 `/Users/<x>`, `/home/<x>`, `C:\Users\<x>` 도 일반 패턴으로 처리한다. */
export function redactHome(text: string, home?: string): string {
  let out = text;
  const h = home ?? homedir();
  if (h && h.length > 1) {
    const variants = [h, h.replace(/\\/g, "/"), h.replace(/\//g, "\\")];
    for (const v of new Set(variants)) {
      out = out.replace(new RegExp(escapeRegExp(v) + "(?=[/\\\\\\s\"'`:)]|$)", "g"), "~");
    }
  }
  out = out.replace(/(?<![\w/])\/(?:Users|home)\/[^/\s"'`:)]+(?=[/\s"'`:)]|$)/g, "~");
  out = out.replace(/\b[A-Za-z]:\\Users\\[^\\\s"'`]+(?=[\\\s"'`]|$)/g, "~");
  return out;
}

export function redact(text: string, opts: RedactOptions = {}): string {
  let out = redactHome(text, opts.home);
  out = redactUrls(out);
  for (const rule of SECRET_RULES) {
    out = out.replace(rule.pattern, rule.replace as string);
  }
  return out;
}

/** redact + 공백 정리 + 길이 컷. 샘플과 통계 문자열에 쓴다. */
export function redactAndTrim(text: string, maxLength: number, opts: RedactOptions = {}): string {
  const collapsed = redact(text, opts).replace(/\s+/g, " ").trim();
  const chars = [...collapsed];
  if (chars.length <= maxLength) return collapsed;
  return chars.slice(0, maxLength - 1).join("") + "…";
}
