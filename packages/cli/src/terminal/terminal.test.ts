import { getCharacter, PALETTE } from "@llmbti/core";
import { describe, expect, it } from "vitest";

import { renderCharacterAnsi, renderFrameAnsi } from "./ansi";
import { bgCode, detectColorMode, displayWidth, fgCode, rgbTo256, stripAnsi } from "./color";
import { axisBar, axisBars, layoutResult } from "./layout";

const E = "\x1b[";

describe("detectColorMode", () => {
  const tty = { isTTY: true, argv: [] as string[] };
  const cases: Array<[string, Parameters<typeof detectColorMode>[0], string]> = [
    ["COLORTERM=truecolor", { ...tty, env: { COLORTERM: "truecolor" } }, "truecolor"],
    ["COLORTERM=24bit", { ...tty, env: { COLORTERM: "24bit", TERM: "xterm" } }, "truecolor"],
    [
      "truecolor beats 256color TERM",
      { ...tty, env: { COLORTERM: "truecolor", TERM: "xterm-256color" } },
      "truecolor",
    ],
    ["TERM=xterm-256color", { ...tty, env: { TERM: "xterm-256color" } }, "256"],
    ["TERM=screen-256color", { ...tty, env: { TERM: "screen-256color" } }, "256"],
    ["TERM=xterm (no 256color)", { ...tty, env: { TERM: "xterm" } }, "256"],
    ["TERM=xterm-color", { ...tty, env: { TERM: "xterm-color" } }, "256"],
    ["TERM=screen", { ...tty, env: { TERM: "screen" } }, "256"],
    ["TERM=tmux", { ...tty, env: { TERM: "tmux" } }, "256"],
    ["TERM=rxvt-unicode", { ...tty, env: { TERM: "rxvt-unicode" } }, "256"],
    ["TERM=vt100", { ...tty, env: { TERM: "vt100" } }, "256"],
    ["TERM=linux", { ...tty, env: { TERM: "linux" } }, "256"],
    ["TERM=dumb", { ...tty, env: { TERM: "dumb" } }, "none"],
    ["TERM empty string", { ...tty, env: { TERM: "" } }, "none"],
    ["no TERM, no COLORTERM", { ...tty, env: {} }, "none"],
    ["TERM=unknown-thing", { ...tty, env: { TERM: "cygwin" } }, "none"],
    [
      "TERM=dumb but NO_COLOR rules still first",
      { ...tty, env: { TERM: "xterm", NO_COLOR: "1" } },
      "none",
    ],
    [
      "NO_COLOR=1 wins over truecolor",
      { ...tty, env: { NO_COLOR: "1", COLORTERM: "truecolor" } },
      "none",
    ],
    [
      "NO_COLOR empty string is ignored",
      { ...tty, env: { NO_COLOR: "", COLORTERM: "truecolor" } },
      "truecolor",
    ],
    ["not a TTY (pipe)", { isTTY: false, argv: [], env: { COLORTERM: "truecolor" } }, "none"],
    [
      "--no-color flag",
      { isTTY: true, argv: ["node", "llmbti", "--no-color"], env: { COLORTERM: "truecolor" } },
      "none",
    ],
  ];
  for (const [name, opts, expected] of cases) {
    it(name, () => {
      expect(detectColorMode(opts)).toBe(expected);
    });
  }
});

describe("rgbTo256", () => {
  it("snaps to the grey ramp for near-greys", () => {
    expect(rgbTo256(17, 17, 17)).toBe(233);
    expect(rgbTo256(0, 0, 0)).toBe(16);
    expect(rgbTo256(128, 128, 128)).toBe(244);
  });
  it("snaps to the cube for saturated colours", () => {
    expect(rgbTo256(255, 0, 0)).toBe(196);
    expect(rgbTo256(0, 255, 0)).toBe(46);
    expect(rgbTo256(0, 0, 255)).toBe(21);
    expect(rgbTo256(255, 255, 255)).toBe(231);
    expect(rgbTo256(92, 92, 92)).toBe(59);
  });
  it("sgr codes per mode", () => {
    expect(fgCode("truecolor", "#FF8000")).toBe(`${E}38;2;255;128;0m`);
    expect(bgCode("256", "#FF0000")).toBe(`${E}48;5;196m`);
    expect(fgCode("none", "#FF0000")).toBe("");
    expect(fgCode("truecolor", "nope")).toBe("");
  });
});

describe("renderFrameAnsi", () => {
  const mini = ["1.", "22", ".3", ".."];
  const palette = [null, "#111111", "#FAFAFA", "#5C5C5C"];

  it("truecolor snapshot: fg = upper, bg = lower, ▄ for lower-only, space for empty", () => {
    expect(renderFrameAnsi(mini, palette, "truecolor")).toEqual([
      `${E}38;2;17;17;17m${E}48;2;250;250;250m▀${E}38;2;250;250;250m${E}49m▄${E}0m`,
      ` ${E}38;2;92;92;92m▀${E}0m`,
    ]);
  });

  it("256 snapshot uses quantized indices", () => {
    expect(renderFrameAnsi(mini, palette, "256")).toEqual([
      `${E}38;5;233m${E}48;5;231m▀${E}38;5;231m${E}49m▄${E}0m`,
      ` ${E}38;5;59m▀${E}0m`,
    ]);
  });

  it("none mode returns no lines", () => {
    expect(renderFrameAnsi(mini, palette, "none")).toEqual([]);
  });

  it("resets before a transparent gap and only emits codes on change", () => {
    const lines = renderFrameAnsi(["11.1", "11.1"], palette, "truecolor");
    expect(lines).toEqual([
      `${E}38;2;17;17;17m${E}48;2;17;17;17m▀▀${E}0m ${E}38;2;17;17;17m${E}48;2;17;17;17m▀${E}0m`,
    ]);
  });

  it("odd row count treats the missing bottom row as transparent", () => {
    expect(renderFrameAnsi(["1"], palette, "truecolor")).toEqual([`${E}38;2;17;17;17m▀${E}0m`]);
  });
});

describe("renderCharacterAnsi", () => {
  it("renders 32×32 as 16 lines of visible width 32", () => {
    const c = getCharacter("INTJ")!;
    for (const mode of ["truecolor", "256"] as const) {
      const lines = renderCharacterAnsi(c, { mode });
      expect(lines).toHaveLength(16);
      for (const l of lines) expect(displayWidth(l)).toBe(32);
    }
  });

  it("returns [] in none mode", () => {
    expect(renderCharacterAnsi(getCharacter("ENFP")!, { mode: "none" })).toEqual([]);
  });

  it("picks the requested frame and falls back to 0 when out of range", () => {
    const c = getCharacter("INTJ")!;
    const f0 = renderCharacterAnsi(c, { mode: "truecolor", frame: 0 });
    const f1 = renderCharacterAnsi(c, { mode: "truecolor", frame: 1 });
    expect(f1).not.toEqual(f0);
    expect(renderCharacterAnsi(c, { mode: "truecolor", frame: 99 })).toEqual(f0);
    expect(renderCharacterAnsi(c, { mode: "truecolor", palette: PALETTE })).toEqual(f0);
  });
});

describe("renderCharacterAnsi with anims", () => {
  it("defaults to the first idle frame when anims is present, else frame 0", () => {
    const base = getCharacter("INTJ")!;
    const withAnims = { ...base, anims: { idle: [1, 1, 0], wave: [0, 1] } };
    const f0 = renderCharacterAnsi(base, { mode: "truecolor", frame: 0 });
    const f1 = renderCharacterAnsi(base, { mode: "truecolor", frame: 1 });
    expect(renderCharacterAnsi(base, { mode: "truecolor" })).toEqual(f0);
    expect(renderCharacterAnsi(withAnims, { mode: "truecolor" })).toEqual(f1);
    expect(renderCharacterAnsi(withAnims, { mode: "truecolor", frame: 0 })).toEqual(f0);
  });
});

describe("layoutResult", () => {
  const characterLines = Array.from(
    { length: 16 },
    (_, i) => `${E}38;2;1;2;3m${"▀".repeat(i % 2 ? 32 : 30)}${E}0m`,
  );
  const rightLines = ["INTJ  리베이스 장인", "", "E ████░░ I", "evidence 1", "evidence 2"];

  it("stacks vertically at width 60", () => {
    const out = layoutResult({ characterLines, rightLines, width: 60 });
    expect(out).toHaveLength(16 + 1 + rightLines.length);
    expect(out.slice(0, 16)).toEqual(characterLines);
    expect(out[16]).toBe("");
    expect(out.slice(17)).toEqual(rightLines);
  });

  it("puts text on the right at width 100, padding the character column to 32 + gap", () => {
    const out = layoutResult({ characterLines, rightLines, width: 100 });
    expect(out).toHaveLength(16);
    const plain = out.map(stripAnsi);
    expect(plain[0]).toBe("▀".repeat(30) + "    " + rightLines[0]);
    expect(plain[1]).toBe("▀".repeat(32)); // empty right line → no trailing pad
    expect(plain[2]).toBe("▀".repeat(30) + "    " + rightLines[2]);
    expect(plain[5]).toBe("▀".repeat(32));
    expect(out[0]!.startsWith(characterLines[0]!)).toBe(true);
  });

  it("extends past the character when the text is longer", () => {
    const out = layoutResult({
      characterLines: ["ab", "cd"],
      rightLines: ["1", "2", "3"],
      width: 120,
      gap: 1,
    });
    expect(out).toEqual(["ab 1", "cd 2", "   3"]);
  });

  it("returns text only when there is no character (none mode)", () => {
    expect(layoutResult({ characterLines: [], rightLines, width: 100 })).toEqual(rightLines);
    expect(layoutResult({ characterLines: [], rightLines, width: 40 })).toEqual(rightLines);
  });
});

describe("axisBar", () => {
  it("fills toward the left letter for positive scores", () => {
    expect(axisBar("E", "I", 33)).toBe("E ████░░ I");
    expect(axisBar("E", "I", 100)).toBe("E ██████ I");
    expect(axisBar("E", "I", -100)).toBe("E ░░░░░░ I");
    expect(axisBar("E", "I", 0)).toBe("E ███░░░ I");
    expect(axisBar("S", "N", -40, { width: 10 })).toBe("S ███░░░░░░░ N");
  });

  it("clamps and tolerates NaN", () => {
    expect(axisBar("T", "F", 500)).toBe("T ██████ F");
    expect(axisBar("T", "F", Number.NaN)).toBe("T ███░░░ F");
  });

  it("axisBars emits EI, SN, TF, JP in order", () => {
    expect(axisBars({ EI: 100, SN: -100, TF: 0, JP: 33 })).toEqual([
      "E ██████ I",
      "S ░░░░░░ N",
      "T ███░░░ F",
      "J ████░░ P",
    ]);
  });
});

describe("displayWidth", () => {
  it("counts hangul as 2, ansi as 0", () => {
    expect(displayWidth("abc")).toBe(3);
    expect(displayWidth("리베이스")).toBe(8);
    expect(displayWidth(`${E}38;2;1;1;1m▀▀${E}0m`)).toBe(2);
    expect(displayWidth("E ████░░ I")).toBe(10);
  });
});
