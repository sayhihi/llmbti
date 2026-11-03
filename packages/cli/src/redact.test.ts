import { describe, expect, it } from "vitest";
import { SECRET_RULES, redact, redactAndTrim, redactHome, redactUrls } from "./redact";

const HOME = "/Users/tester";

describe("redact: 시크릿 패턴", () => {
  const cases: Array<[name: string, input: string, mustNotContain: string, mustContain: string]> = [
    ["sk-", "key sk-abcdefghijklmnopqrstuvwxyz1234 x", "abcdefghijklmnop", "[SK_TOKEN]"],
    ["sk-ant-", "sk-ant-api03-AbCdEfGhIjKlMnOpQrStUvWxYz0123456789", "AbCdEfGh", "[SK_TOKEN]"],
    ["ghp_", "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef123456", "ABCDEFGHIJ", "[GITHUB_TOKEN]"],
    [
      "github_pat_",
      "github_pat_11ABCDEFG0123456789abcdefghijklmnop",
      "11ABCDEFG",
      "[GITHUB_TOKEN]",
    ],
    ["xoxb-", "xoxb-1234567890-abcdefghijklmnop", "1234567890-abc", "[SLACK_TOKEN]"],
    ["xoxp-", "xoxp-9876543210-zyxwvutsrqponm", "9876543210", "[SLACK_TOKEN]"],
    ["AKIA", "AKIAIOSFODNN7EXAMPLE", "IOSFODNN7", "[AWS_KEY]"],
    ["AIza", "AIzaSyA1234567890abcdefghijklmnopqrstuv", "SyA12345", "[GOOGLE_KEY]"],
    ["npm_", "npm_abcdefghijklmnopqrstuvwxyz0123456789", "abcdefghijklmnop", "[NPM_TOKEN]"],
    [
      "JWT",
      "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
      "eyJzdWIi",
      "[JWT]",
    ],
    [
      "Bearer",
      "Authorization: Bearer abcdefghijklmnopqrstuvwxyz",
      "abcdefghijklmnop",
      "Bearer [TOKEN]",
    ],
    ["Stripe", "sk_live_abcdefghijklmnop1234", "abcdefghijklmnop", "[STRIPE_KEY]"],
    [
      "hex 32+",
      "sha 0123456789abcdef0123456789abcdef",
      "0123456789abcdef0123456789abcdef",
      "[HEX]",
    ],
    ["base64 32+", "blob QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVo0MTIz", "QUJDREVG", "[BASE64]"],
    [
      "private key",
      "-----BEGIN RSA PRIVATE KEY-----\nMIIE\n-----END RSA PRIVATE KEY-----",
      "MIIE",
      "[PRIVATE_KEY]",
    ],
    [
      "slack webhook",
      "https://hooks.slack.com/services/T000/B000/XXXX",
      "T000/B000",
      "[SLACK_WEBHOOK]",
    ],
  ];
  it.each(cases)("%s", (_name, input, mustNotContain, mustContain) => {
    const out = redact(input, { home: HOME });
    expect(out).not.toContain(mustNotContain);
    expect(out).toContain(mustContain);
  });

  it("패턴이 10종 이상", () => {
    expect(SECRET_RULES.length).toBeGreaterThanOrEqual(10);
  });
});

describe("redact: 개인정보", () => {
  it("이메일", () => {
    expect(redact("tester@example.com 으로 보내")).toBe("[EMAIL] 으로 보내");
  });
  it("전화번호", () => {
    expect(redact("010-1234-5678 로")).toBe("[PHONE] 로");
    expect(redact("+82 10 1234 5678")).toBe("[PHONE]");
    expect(redact("(02) 123-4567")).toBe("[PHONE]");
    // 버전이나 짧은 숫자는 건드리지 않는다
    expect(redact("v1.2.3 과 2026")).toBe("v1.2.3 과 2026");
  });
  it("IP", () => {
    expect(redact("서버 192.168.0.10 에서")).toBe("서버 [IP] 에서");
    expect(redact("node 18.0.0")).toBe("node 18.0.0");
  });
  it("URL 의 userinfo 와 쿼리", () => {
    expect(redactUrls("https://admin:pw@db.example.com:5432/app?sslmode=require#frag")).toBe(
      "https://[USERINFO]@db.example.com:5432/app?[QUERY]#frag",
    );
    expect(redactUrls("http://localhost:3000/path")).toBe("http://localhost:3000/path");
    expect(redactUrls("postgres://u:p@h/db")).toBe("postgres://[USERINFO]@h/db");
  });
  it("password= / token= / secret= 값", () => {
    expect(redact("DB_PASSWORD=hunter2")).toBe("DB_PASSWORD=[REDACTED]");
    expect(redact('token: "abc"')).toBe("token: [REDACTED]");
    expect(redact("secret = 'x y'")).toBe("secret = [REDACTED]");
    expect(redact("api_key=xyz 그리고 apiKey=abc")).toBe(
      "api_key=[REDACTED] 그리고 apiKey=[REDACTED]",
    );
    expect(redact("password 바꿔줘")).toBe("password 바꿔줘");
  });
});

describe("redactHome", () => {
  it("명시된 홈과 일반 /Users, /home, C:\\Users 패턴을 ~ 로", () => {
    expect(redactHome("/Users/tester/work/app/.env", HOME)).toBe("~/work/app/.env");
    expect(redactHome("cd /Users/tester", HOME)).toBe("cd ~");
    expect(redactHome("/home/someone/x.txt", HOME)).toBe("~/x.txt");
    expect(redactHome("C:\\Users\\someone\\x.txt", HOME)).toBe("~\\x.txt");
    expect(redactHome("/Users/tester2/x", HOME)).toBe("~/x"); // 다른 사용자도 일반 패턴으로
    expect(redactHome("/usr/local/bin", HOME)).toBe("/usr/local/bin");
  });
});

describe("redactAndTrim", () => {
  it("공백을 정리하고 길이를 자른다 (코드 포인트 기준)", () => {
    expect(redactAndTrim("  a \n\n b  ", 10)).toBe("a b");
    const long = "가".repeat(200);
    const out = redactAndTrim(long, 120);
    expect([...out].length).toBe(120);
    expect(out.endsWith("…")).toBe(true);
  });
  it("홈 경로와 시크릿을 같이 처리한다", () => {
    const out = redactAndTrim("/Users/tester/.env 에 sk-abcdefghijklmnopqrstuvwxyz1234 넣어", 120, {
      home: HOME,
    });
    expect(out).toBe("~/.env 에 [SK_TOKEN] 넣어");
  });
});
