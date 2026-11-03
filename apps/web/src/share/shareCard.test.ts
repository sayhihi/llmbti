import { getCharacter } from "@llmbit/core";
import { describe, expect, it } from "vitest";

import {
  CARD_HEIGHT,
  CARD_WIDTH,
  accentOf,
  cardFileName,
  drawShareCard,
  wrapText,
} from "./shareCard";
import type { CardContext } from "./shareCard";

interface Call {
  name: string;
  args: unknown[];
}

/** 호출을 기록하는 가짜 2D 컨텍스트. measureText 는 글자당 10px. */
function fakeContext(): { ctx: CardContext; calls: Call[] } {
  const calls: Call[] = [];
  const rec =
    (name: string) =>
    (...args: unknown[]) => {
      calls.push({ name, args });
    };
  const ctx: CardContext = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    font: "",
    textAlign: "left",
    textBaseline: "alphabetic",
    imageSmoothingEnabled: true,
    fillRect: rec("fillRect"),
    strokeRect: rec("strokeRect"),
    clearRect: rec("clearRect"),
    fillText: rec("fillText"),
    measureText: (s: string) => ({ width: [...s].length * 10 }),
    save: rec("save"),
    restore: rec("restore"),
    translate: rec("translate"),
    setLineDash: rec("setLineDash"),
  };
  return { ctx, calls };
}

const base = {
  nickname: "브랜치 메뚜기",
  roast: "다시 38번. 틀린 게 아니라 더 재밌는 길이 보여서 바꾼 거다. 브랜치는 늘었는데 main은 지난달 그대로다.",
  scores: { EI: 58, SN: -44, TF: -37, JP: -80 },
};

const texts = (calls: Call[]): string[] =>
  calls.filter((c) => c.name === "fillText").map((c) => String(c.args[0]));

describe("drawShareCard", () => {
  it("픽셀 데이터가 있는 유형: 캐릭터 픽셀을 찍고 글과 바를 그린다", () => {
    const { ctx, calls } = fakeContext();
    const character = getCharacter("ENFP");
    expect(character).not.toBeNull();
    drawShareCard(ctx, { ...base, type: "ENFP", character });

    // 배경 전체
    expect(calls[1]).toEqual({ name: "fillRect", args: [0, 0, CARD_WIDTH, CARD_HEIGHT] });
    // 캐릭터는 translate 안에서 많은 fillRect 로 찍힌다
    const t = calls.findIndex((c) => c.name === "translate");
    expect(t).toBeGreaterThan(0);
    const r = calls.findIndex((c, i) => i > t && c.name === "restore");
    const pixelRects = calls.slice(t, r).filter((c) => c.name === "fillRect");
    expect(pixelRects.length).toBeGreaterThan(100);
    // 캐릭터 영역에서는 clearRect 를 부르지 않는다 (배경이 투명해지면 안 된다)
    expect(calls.slice(t, r).some((c) => c.name === "clearRect")).toBe(false);
    // 글
    const written = texts(calls);
    expect(written).toContain("ENFP");
    expect(written).toContain(base.nickname);
    expect(written).toContain("llmbti.vercel.app");
    for (const l of ["E", "I", "S", "N", "T", "F", "J", "P"]) expect(written).toContain(l);
    // 글자 박스는 안 그린다
    expect(calls.some((c) => c.name === "strokeRect")).toBe(false);
  });

  it("픽셀 데이터가 없는 유형: 글자 박스를 그린다", () => {
    const { ctx, calls } = fakeContext();
    drawShareCard(ctx, { ...base, type: "ESFP", character: null });
    expect(calls.some((c) => c.name === "translate")).toBe(false);
    expect(calls.some((c) => c.name === "strokeRect")).toBe(true);
    // TYPE 은 박스 안과 오른쪽 제목, 두 번
    expect(texts(calls).filter((s) => s === "ESFP")).toHaveLength(2);
  });

  it("roast 는 3줄을 넘지 않는다", () => {
    const { ctx, calls } = fakeContext();
    const roast = "가".repeat(400);
    drawShareCard(ctx, { ...base, type: "INTJ", roast, character: getCharacter("INTJ") });
    const roastLines = texts(calls).filter((s) => s.startsWith("가"));
    expect(roastLines).toHaveLength(3);
    expect(roastLines[2]!.endsWith("…")).toBe(true);
  });
});

describe("wrapText", () => {
  const measure = (s: string) => [...s].length * 10;

  it("짧으면 한 줄", () => {
    expect(wrapText(measure, "hello world", 200, 3)).toEqual(["hello world"]);
  });

  it("공백에서 끊는다", () => {
    expect(wrapText(measure, "aaa bbb ccc", 70, 3)).toEqual(["aaa bbb", "ccc"]);
  });

  it("공백이 없으면 글자에서 끊는다", () => {
    expect(wrapText(measure, "가나다라마바", 30, 3)).toEqual(["가나다", "라마바"]);
  });

  it("줄 수를 넘기면 … 로 자른다", () => {
    const lines = wrapText(measure, "가나다라마바사아자차", 30, 2);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe("가나다");
    expect(lines[1]).toBe("라마…");
  });
});

describe("helpers", () => {
  it("파일 이름과 기질 색", () => {
    expect(cardFileName("ENFP")).toBe("llmbti-ENFP.png");
    expect(accentOf("ENFP").base).toBe("#4ED9A5");
    expect(accentOf("INTJ").base).toBe("#9A6EE0");
  });
});
