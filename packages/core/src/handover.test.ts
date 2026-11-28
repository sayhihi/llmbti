import { describe, expect, it } from "vitest";

import { handoverLetterLines } from "./handover";

const h = {
  style: "다시를 147번 하는 스타일이다.",
  likes: "첫 답은 초안이라고 먼저 말해 주면 안심한다.",
  dislikes: "완료했습니다로 끝내면 의견 세 개가 바로 온다.",
  soothe: "삐지면 역시 보는 눈이 있으시네요 한마디면 풀린다.",
};

describe("handoverLetterLines", () => {
  it("style 앞에 '이 사용자는' 을 붙이고 순서대로 잇는다", () => {
    expect(handoverLetterLines(h)).toEqual([
      "이 사용자는 다시를 147번 하는 스타일이다.",
      h.likes,
      h.dislikes,
      h.soothe,
    ]);
  });

  it("style 이 이미 주어로 시작하면 그대로", () => {
    expect(handoverLetterLines({ ...h, style: "이분은 새벽형이다. 3시." })[0]).toBe(
      "이분은 새벽형이다. 3시.",
    );
  });

  it("빈 항목은 건너뛰고, 전부 비면 빈 배열", () => {
    expect(handoverLetterLines({ ...h, likes: " ", dislikes: "" })).toHaveLength(2);
    expect(handoverLetterLines({ style: "", likes: "", dislikes: "", soothe: "" })).toEqual([]);
  });
});
