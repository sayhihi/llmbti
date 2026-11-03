import { describe, expect, it } from "vitest";

import { displayWidth } from "./color";
import { wrapLines, wrapText } from "./wrap";

describe("wrapText", () => {
  it("한글은 2칸으로 세서 끊는다", () => {
    const lines = wrapText("새벽 2시에서 5시 사이 활동 34%", 14);
    for (const l of lines) expect(displayWidth(l)).toBeLessThanOrEqual(14);
    expect(lines).toEqual(["새벽 2시에서", "5시 사이 활동", "34%"]);
  });

  it("폭 안에 들어가면 한 줄", () => {
    expect(wrapText("E ████░░ I", 40)).toEqual(["E ████░░ I"]);
    expect(wrapText("", 10)).toEqual([""]);
  });

  it("폭보다 긴 단어는 글자 단위로 자른다", () => {
    const lines = wrapText("가나다라마바사아자차", 6);
    expect(lines).toEqual(["가나다", "라마바", "사아자", "차"]);
    expect(wrapText("abcdefghij", 4)).toEqual(["abcd", "efgh", "ij"]);
  });

  it("wrapLines는 빈 줄을 유지한다", () => {
    expect(wrapLines(["ENFP  브랜치 메뚜기", "", "x"], 12)).toEqual([
      "ENFP 브랜치",
      "메뚜기",
      "",
      "x",
    ]);
    // 폭 안에 들어가면 겹공백을 그대로 둔다
    expect(wrapLines(["ENFP  브랜치 메뚜기"], 40)).toEqual(["ENFP  브랜치 메뚜기"]);
  });
});
