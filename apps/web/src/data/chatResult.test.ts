import { describe, expect, it } from "vitest";

import { decodeCompact, encodeChatLink, encodeCompact } from "@llmbti/core";

import {
  alignScores,
  chatLinkToObject,
  cleanText,
  findResultObject,
  parseChatLinkHash,
  parseChatResult,
} from "./chatResult";

const CODE = `{
  "llmbti": 1,
  "method": "기록",
  "confidence": "보통",
  "type": "ENFP",
  "scores": { "EI": 34, "SN": -12, "TF": -50, "JP": -8 },
  "nickname": "아니 그게 아니라 장인",
  "roast": "질문 하나에 아니 그게 아니라가 세 번 붙는다. 방향은 매번 새로 정한다.",
  "evidence": ["답변 도중 자주 끼어든다", "고마워를 거의 매번 붙인다", "처음부터 다시를 자주 한다"],
  "status": "오늘도 방향 수정 중",
  "pair": { "type": "ISTJ", "reason": "순서는 저쪽이 정해 줌" },
  "handover": {
    "style": "방향을 4번 바꾸는 스타일이다.",
    "likes": "첫 답은 초안이라고 먼저 말해 주면 안심한다.",
    "dislikes": "완료했습니다로 끝내면 의견이 바로 온다.",
    "soothe": "역시 보는 눈이 있으시네요 한마디. 우쭈쭈."
  }
}`;

/** ChatGPT 답변 전체를 복사한 모양: 결과 설명 + 코드 펜스 + 마지막 안내 */
const WHOLE_ANSWER = `판정 방식: 기록 판정, 신뢰도 보통
유형: ENFP
E ████░░ I  +34

별명: 아니 그게 아니라 장인

아래 결과 코드를 복사해서 llmbti.vercel.app/paste 에 붙여넣으면 캐릭터와 공유 카드가 나와.

\`\`\`json
${CODE}
\`\`\`

더 정확히 알고 싶으면 12문항 줘 라고 말해줘.`;

describe("findResultObject", () => {
  it("코드 블록만 붙여넣어도, 답변 전체를 붙여넣어도 찾는다", () => {
    expect(findResultObject(CODE)?.type).toBe("ENFP");
    expect(findResultObject(WHOLE_ANSWER)?.type).toBe("ENFP");
  });

  it("llmbti 키가 없는 JSON 은 무시한다", () => {
    expect(findResultObject('{"type":"ENFP"}')).toBeNull();
    expect(findResultObject("그냥 글")).toBeNull();
  });

  it("둥근 따옴표와 끝에 남은 쉼표를 고친다", () => {
    const messy = `{“llmbti”: 1, “type”: “INTJ”, “scores”: [10, 20, 30, 40],}`;
    expect(findResultObject(messy)?.type).toBe("INTJ");
  });

  it("문자열 안의 둥근 따옴표와 중괄호는 건드리지 않는다", () => {
    const s = `{"llmbti":1,"type":"ISTP","roast":"“고쳐” 한 마디에 {끝}."}`;
    expect(findResultObject(s)?.roast).toBe("“고쳐” 한 마디에 {끝}.");
  });

  it("문자열 안에 줄바꿈이 들어가도 읽는다", () => {
    const s = `{"llmbti":1,"type":"ISTP","roast":"첫 줄.\n둘째 줄."}`;
    expect(findResultObject(s)?.roast).toBe("첫 줄. 둘째 줄.");
  });
});

describe("parseChatResult", () => {
  it("chat 모드 payload 를 만들고 compact 링크로 왕복한다", () => {
    const r = parseChatResult(WHOLE_ANSWER);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const p = r.payload;
    expect(p.mode).toBe("chat");
    expect(p.type).toBe("ENFP");
    expect(p.scores).toEqual({ EI: 34, SN: -12, TF: -50, JP: -8 });
    expect(p.chat).toEqual({ method: "record", confidence: "mid" });
    expect(p.copy.commitMessage).toBe("오늘도 방향 수정 중");
    expect(p.copy.pairWith).toEqual({ type: "ISTJ", reason: "순서는 저쪽이 정해 줌" });
    expect(p.copy.handover?.soothe).toContain("우쭈쭈");
    expect(p.badges).toEqual([]);
    expect(decodeCompact(encodeCompact(p))).toEqual(p);
  });

  it("audience 가 개발이면 chat.audience dev, 일반이나 없으면 생략", () => {
    const dev = parseChatResult(
      CODE.replace('"method": "기록",', '"method": "기록", "audience": "개발",'),
    );
    expect(dev.ok && dev.payload.chat).toEqual({
      method: "record",
      confidence: "mid",
      audience: "dev",
    });
    const general = parseChatResult(
      CODE.replace('"method": "기록",', '"method": "기록", "audience": "일반",'),
    );
    expect(general.ok && general.payload.chat).toEqual({ method: "record", confidence: "mid" });
    expect(
      parseChatResult(CODE).ok &&
        "audience" in (parseChatResult(CODE) as { payload: { chat: object } }).payload.chat,
    ).toBe(false);
  });

  it("설문 판정이면 audience 가 개발이어도 일반으로 본다", () => {
    const r = parseChatResult(
      CODE.replace('"method": "기록",', '"method": "설문", "audience": "개발",'),
    );
    expect(r.ok && r.payload.chat).toEqual({ method: "survey" });
  });

  it("설문 판정이면 신뢰도는 버린다", () => {
    const r = parseChatResult(CODE.replace('"기록"', '"설문"'));
    expect(r.ok && r.payload.chat).toEqual({ method: "survey" });
  });

  it("유형과 점수 부호가 어긋나면 유형을 믿는다", () => {
    const r = parseChatResult(
      `{"llmbti":1,"type":"INTP","scores":{"EI":30,"SN":-10,"TF":40,"JP":"+12"}}`,
    );
    expect(r.ok && r.payload.scores).toEqual({ EI: -30, SN: -10, TF: 40, JP: -12 });
  });

  it("유형이 없으면 점수로 정하고, 둘 다 없으면 badType", () => {
    const r = parseChatResult(`{"llmbti":1,"scores":[5,-5,5,-5]}`);
    expect(r.ok && r.payload.type).toBe("ENTP");
    expect(parseChatResult(`{"llmbti":1,"type":"ABCD"}`)).toEqual({ ok: false, reason: "badType" });
  });

  it("빈 입력과 코드 없는 입력", () => {
    expect(parseChatResult("  ")).toEqual({ ok: false, reason: "empty" });
    expect(parseChatResult("유형: ENFP")).toEqual({ ok: false, reason: "noCode" });
  });

  it("길이를 넘으면 자르고, 근거는 3개까지", () => {
    const long = JSON.stringify({
      llmbti: 1,
      type: "ESFJ",
      nickname: "가".repeat(40),
      evidence: ["하나", "둘", "셋", "넷"],
      handover: { 스타일: "나".repeat(200), soothe: "우쭈쭈" },
    });
    const r = parseChatResult(long);
    if (!r.ok) throw new Error("parse failed");
    expect([...r.payload.copy.nickname]).toHaveLength(20);
    expect(r.payload.copy.evidence).toEqual(["하나", "둘", "셋"]);
    expect([...r.payload.copy.handover!.style]).toHaveLength(45);
    expect(r.payload.copy.handover).toMatchObject({ likes: "", dislikes: "", soothe: "우쭈쭈" });
  });

  it("handover 가 비었거나 없으면 싣지 않는다", () => {
    const empty = parseChatResult(`{"llmbti":1,"type":"ENFP","handover":{"style":" "}}`);
    expect(empty.ok && "handover" in empty.payload.copy).toBe(false);
    const none = parseChatResult(`{"llmbti":1,"type":"ENFP"}`);
    expect(none.ok && "handover" in none.payload.copy).toBe(false);
  });

  it("페어 유형이 없으면 네 글자를 뒤집은 유형", () => {
    const r = parseChatResult(`{"llmbti":1,"type":"ENFP"}`);
    expect(r.ok && r.payload.copy.pairWith.type).toBe("ISTJ");
  });
});

describe("cleanText", () => {
  it("이모지, 가운뎃점, 줄표를 정리한다", () => {
    expect(cleanText("고마워 ㅋㅋ 🙏 · 다시 — 또 다시", 100)).toBe("고마워 ㅋㅋ, 다시, 또 다시");
  });

  it("이메일, 링크, 전화번호를 가린다", () => {
    expect(cleanText("me@example.com 으로 https://a.b/c?x=1 010-1234-5678", 100)).toBe(
      "[이메일] 으로 [링크] [전화번호]",
    );
  });

  it("문자열이 아니면 빈 문자열", () => {
    expect(cleanText(3, 10)).toBe("");
  });
});

describe("alignScores", () => {
  it("범위를 자르고, 뒤 글자 유형의 0 점은 -1", () => {
    expect(alignScores("ISFP", { EI: 0, SN: 250, TF: -3.6 })).toEqual({
      EI: -1,
      SN: 100,
      TF: -4,
      JP: -20,
    });
  });
});

/**
 * 채팅 프롬프트의 파이썬 링크 코드(chatPrompt.ts linkCode)를 실제로 돌려서 나온 값.
 * 2026-11-28 사용자 테스트 결과(ESTJ)를 넣었다. 파이썬 zlib 과 웹 fflate 가 같은 걸 읽는지 고정한다.
 */
const PYTHON_LINK =
  "XVPBbtpAFPyVlc9WpURR1GsOPdBre4vyLwYcZAFV04DBJLvIbkwBiYMDhkDl_tC-t__QWTtg2pPXfu_Nzswb3164zqcvXz877u3llXt96V58dK-u71xH7zNKlOM61Hlk1beH4dDc91kVgqcJdYdCrzO9KXT2QN_vUb9pmFCiQ6CFlS9onuh1gUb6lgke5dR94HYgbho68zDrcRBR9qw3MfAC6qUfBOcBhwEr73TKUXYFT3x66dsrq5MF4NCnXjVGfmq_UGtJA2XCnENQnPs8l4KailrSdkEgNOUoeNyTtNqzLCiRgp8fTBjVcngC7J2keCZMFHJPWSl6u-J1znHzOASQOITcCtkBCBBB9M-QBhLPIOJDhOfvhNcRzQphJpKfliBX1uxsLGjn0c63-PbDJDTTAMhP1rEKtmJkx2GUtYUeUx7Dbl-YH9JEPqoltySrmiLabK0BvrQGm04MadZg4NFgdQTGdmunLXLZBLYKEuHZcc8lsymWGHN3-242WDXKuNiAcOr9x17luP546SEmuaBfq8rctuBxBw2iVsWvE71eAKVe0DlmBXNmQlPpQx_e13oEd1PT9kqy-dG107LUXui3Qr9m5VJL3wWSQt0ZVnfKGJK6KDgG6ibn8YpfClpiTT97iFi9Yup7vFv-q7BKoxlZZ8p3P-bR3sYJAPYH2gG7FcGIM5wqrHXsKFua0cwa8-5_baclpPZWrCosfhmfNMIblnj3Fw";

describe("채팅 링크 (/c#j=)", () => {
  it("파이썬 코드가 만든 링크를 읽어 chat payload 로 만든다", () => {
    const r = parseChatLinkHash(`#j=${PYTHON_LINK}`);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const p = r.payload;
    expect(p.type).toBe("ESTJ");
    expect(p.mode).toBe("chat");
    expect(p.scores).toEqual({ EI: 24, SN: 62, TF: 18, JP: 46 });
    expect(p.chat).toEqual({ method: "record", confidence: "high" });
    expect(p.copy.nickname).toBe("디테일 잡는 결과감독");
    expect(p.copy.evidence).toHaveLength(3);
    expect(p.copy.pairWith.type).toBe("ISTJ");
    expect(p.copy.handover?.soothe).toBe("네가 원하는 방향이 이제 정확히 보인다라고 해 줘라.");
    expect(decodeCompact(encodeCompact(p))).toEqual(p);
  });

  it("채팅 앱이 붙인 ?utm_source 는 무시한다", () => {
    const r = parseChatLinkHash(`#j=${PYTHON_LINK}?utm_source=chatgpt.com`);
    expect(r.ok && r.payload.type).toBe("ESTJ");
  });

  it("잘리거나 바뀐 링크, 빈 링크는 badLink", () => {
    expect(parseChatLinkHash(`#j=${PYTHON_LINK.slice(0, 300)}`)).toEqual({
      ok: false,
      reason: "badLink",
    });
    expect(parseChatLinkHash("#j=")).toEqual({ ok: false, reason: "badLink" });
    expect(parseChatLinkHash("")).toEqual({ ok: false, reason: "badLink" });
    expect(parseChatLinkHash(`#j=${encodeChatLink({ not: "array" })}`)).toEqual({
      ok: false,
      reason: "badLink",
    });
  });

  it("링크 배열 끝의 audience 를 읽고, 옛 링크(칸 없음)는 일반으로 본다", () => {
    const old = parseChatLinkHash(`#j=${PYTHON_LINK}`);
    expect(old.ok && old.payload.chat?.audience).toBeUndefined();
    const dev = parseChatLinkHash(
      `#j=${encodeChatLink([1, "ISTP", [-10, 20, 30, -5], "기록", "높음", "n", "r", [], "fix: 다시", "ENFJ", "이유", ["a 1", "", "", ""], "개발"])}`,
    );
    expect(dev.ok && dev.payload.chat).toEqual({
      method: "record",
      confidence: "high",
      audience: "dev",
    });
  });

  it("배열 버전이 다르면 null, 뒤쪽 칸이 없어도 앞쪽만으로 읽는다", () => {
    expect(chatLinkToObject([2, "ENFP"])).toBeNull();
    const r = parseChatLinkHash(`#j=${encodeChatLink([1, "INTP", [-10, -20, 30, -5]])}`);
    expect(r.ok && r.payload.type).toBe("INTP");
    expect(r.ok && "handover" in r.payload.copy).toBe(false);
  });
});
