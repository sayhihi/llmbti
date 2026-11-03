import { describe, expect, it } from "vitest";

import { MBTI_TYPES, TEMPERAMENT_OF, TEMPERAMENT_PALETTE } from "../types";
import { TYPE_META, getTypeMeta } from "../typeMeta";
import { DRAWN_TYPES, getAnim, getCharacter, hasCharacter } from "./characters";
import { drawFrame, frameSize, type DrawContext } from "./draw";
import { PALETTE, PALETTE_NAMES, hexToRgb } from "./palette";
import { PALETTE_SIZE, PIXEL_SIZE, type PixelCharacter } from "./types";
import { PixelCharacterError, validateCharacter } from "./validate";

function blankFrame(rows = PIXEL_SIZE, cols = PIXEL_SIZE): string[] {
  return Array.from({ length: rows }, () => ".".repeat(cols));
}

function goodCharacter(): PixelCharacter {
  return { id: "TEST", size: 32, fps: 4, frames: [blankFrame()] };
}

describe("PALETTE", () => {
  it("has 16 entries with index 0 transparent", () => {
    expect(PALETTE).toHaveLength(PALETTE_SIZE);
    expect(PALETTE[0]).toBeNull();
    expect(PALETTE_NAMES[0]).toBe("transparent");
    for (const hex of PALETTE.slice(1)) expect(hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it("temperament body colours point at base/shadow pairs", () => {
    expect(PALETTE_NAMES[TEMPERAMENT_PALETTE.NT[0]]).toBe("nt-base");
    expect(PALETTE_NAMES[TEMPERAMENT_PALETTE.NT[1]]).toBe("nt-shadow");
    expect(PALETTE_NAMES[TEMPERAMENT_PALETTE.SP[0]]).toBe("sp-base");
  });

  it("hexToRgb parses and rejects", () => {
    expect(hexToRgb("#FF8000")).toEqual([255, 128, 0]);
    expect(hexToRgb("0a0b0c")).toEqual([10, 11, 12]);
    expect(hexToRgb("#fff")).toBeNull();
    expect(hexToRgb("red")).toBeNull();
  });
});

describe("validateCharacter", () => {
  it("accepts a well-formed character", () => {
    expect(() => validateCharacter(goodCharacter())).not.toThrow();
  });

  it("rejects wrong row count", () => {
    const c = goodCharacter();
    c.frames[0] = blankFrame(31);
    expect(() => validateCharacter(c)).toThrow(PixelCharacterError);
    expect(() => validateCharacter(c)).toThrow(/frame 0 has 31 rows/);
  });

  it("rejects wrong row length", () => {
    const c = goodCharacter();
    c.frames[0]![5] = ".".repeat(33);
    expect(() => validateCharacter(c)).toThrow(/row 5 has length 33/);
  });

  it("rejects invalid characters, including 0 and uppercase hex", () => {
    for (const bad of ["0", "g", "F", " "]) {
      const c = goodCharacter();
      c.frames[0]![2] = bad + ".".repeat(31);
      expect(() => validateCharacter(c)).toThrow(/row 2 col 0: invalid char/);
    }
  });

  it("accepts anims whose indices point at existing frames", () => {
    const c: PixelCharacter = { ...goodCharacter(), frames: [blankFrame(), blankFrame()] };
    c.anims = { idle: [0, 0, 1], wave: [1, 0] };
    expect(() => validateCharacter(c)).not.toThrow();
  });

  it("rejects anims with empty arrays, out-of-range or non-integer indices", () => {
    const two = () => ({ ...goodCharacter(), frames: [blankFrame(), blankFrame()] });
    expect(() => validateCharacter({ ...two(), anims: { idle: [] } })).toThrow(
      /anims\.idle must be a non-empty array/,
    );
    expect(() => validateCharacter({ ...two(), anims: { walk: [0, 2] } })).toThrow(
      /anims\.walk\[1\] = 2 is not a frame index \(0\.\.1\)/,
    );
    expect(() => validateCharacter({ ...two(), anims: { walk: [-1] } })).toThrow(
      /anims\.walk\[0\]/,
    );
    expect(() => validateCharacter({ ...two(), anims: { walk: [0.5] } })).toThrow(
      /anims\.walk\[0\]/,
    );
    expect(() => validateCharacter({ ...two(), anims: { walk: ["0"] } })).toThrow(
      /anims\.walk\[0\]/,
    );
    expect(() => validateCharacter({ ...two(), anims: [0] })).toThrow(/anims must be an object/);
    expect(() => validateCharacter({ ...two(), anims: null })).toThrow(/anims must be an object/);
  });

  it("rejects bad size, fps, frames and non-objects", () => {
    expect(() => validateCharacter(null)).toThrow(PixelCharacterError);
    expect(() => validateCharacter({ ...goodCharacter(), size: 16 })).toThrow(/size must be 32/);
    expect(() => validateCharacter({ ...goodCharacter(), fps: 0 })).toThrow(/fps/);
    expect(() => validateCharacter({ ...goodCharacter(), frames: [] })).toThrow(/frames/);
    expect(() => validateCharacter({ ...goodCharacter(), id: "" })).toThrow(/id/);
  });
});

describe("getCharacter", () => {
  it("returns all 16 types and the base, each with 6 frames and the 4 named anims", () => {
    for (const id of [...MBTI_TYPES, "_base"] as const) {
      const c = getCharacter(id);
      expect(c).not.toBeNull();
      expect(c!.id).toBe(id);
      expect(c!.size).toBe(PIXEL_SIZE);
      expect(c!.frames).toHaveLength(6);
      expect(Object.keys(c!.anims ?? {}).sort()).toEqual(["blink", "idle", "walk", "wave"]);
    }
    expect(DRAWN_TYPES).toEqual([...MBTI_TYPES]);
    for (const t of MBTI_TYPES) expect(hasCharacter(t)).toBe(true);
  });

  it("samples use their temperament body colour", () => {
    for (const t of DRAWN_TYPES) {
      const [base] = TEMPERAMENT_PALETTE[TEMPERAMENT_OF(t)];
      const used = new Set(getCharacter(t)!.frames[0]!.join("").replace(/\./g, ""));
      expect(used.has(base.toString(16))).toBe(true);
    }
  });
});

describe("getAnim", () => {
  const frames = [blankFrame(), blankFrame(), blankFrame()];

  it("returns the named sequence as a copy", () => {
    const c: PixelCharacter = {
      id: "T",
      size: 32,
      fps: 6,
      frames,
      anims: { idle: [0, 0, 1], wave: [2, 1, 2, 0] },
    };
    const idle = getAnim(c, "idle");
    expect(idle).toEqual([0, 0, 1]);
    idle.push(99);
    expect(c.anims!.idle).toEqual([0, 0, 1]);
    expect(getAnim(c, "wave")).toEqual([2, 1, 2, 0]);
  });

  it("falls back to all frame indices when the name or anims is missing", () => {
    const withAnims: PixelCharacter = { id: "T", size: 32, fps: 4, frames, anims: { idle: [1] } };
    expect(getAnim(withAnims, "walk")).toEqual([0, 1, 2]);
    expect(getAnim({ id: "T", size: 32, fps: 4, frames }, "idle")).toEqual([0, 1, 2]);
    expect(getAnim(getCharacter("INTJ")!, "idle")).toEqual([0]);
    expect(getAnim(getCharacter("INTJ")!, "blink")).toEqual([1]);
  });
});

describe("drawFrame", () => {
  function fakeCtx() {
    const calls: Array<{ op: string; args: unknown[] }> = [];
    const ctx: DrawContext & { calls: typeof calls } = {
      calls,
      fillStyle: "",
      fillRect(x, y, w, h) {
        calls.push({ op: "fillRect", args: [this.fillStyle, x, y, w, h] });
      },
      clearRect(x, y, w, h) {
        calls.push({ op: "clearRect", args: [x, y, w, h] });
      },
    };
    return ctx;
  }

  it("clears then fills one rect per opaque pixel, scaled", () => {
    const ctx = fakeCtx();
    const palette = [null, "#111111", "#222222", "#333333"];
    drawFrame(ctx, ["1.", ".3"], palette, 10);
    expect(ctx.calls).toEqual([
      { op: "clearRect", args: [0, 0, 20, 20] },
      { op: "fillRect", args: ["#111111", 0, 0, 10, 10] },
      { op: "fillRect", args: ["#333333", 10, 10, 10, 10] },
    ]);
  });

  it("skips palette entries that are missing", () => {
    const ctx = fakeCtx();
    drawFrame(ctx, ["f1", ".."], [null, "#abcdef"], 1);
    expect(ctx.calls.filter((c) => c.op === "fillRect")).toEqual([
      { op: "fillRect", args: ["#abcdef", 1, 0, 1, 1] },
    ]);
  });

  it("frameSize reports cols × rows", () => {
    expect(frameSize(getCharacter("INTJ")!.frames[0]!)).toEqual({ width: 32, height: 32 });
    expect(frameSize(["1.", ".3", ".."])).toEqual({ width: 2, height: 3 });
  });
});

describe("TYPE_META", () => {
  it("covers all 16 types with valid relations", () => {
    for (const t of MBTI_TYPES) {
      const m = TYPE_META[t];
      expect(m.nickname.length).toBeLessThanOrEqual(20);
      expect(MBTI_TYPES).toContain(m.pairWith.type);
      expect(MBTI_TYPES).toContain(m.clashWith.type);
      expect(getTypeMeta(t)).toBe(m);
    }
    expect(TYPE_META.INTJ.nickname).toBe("리베이스 장인");
  });

  it("TEMPERAMENT_OF splits by N/S then T/F or J/P", () => {
    expect(TEMPERAMENT_OF("INTJ")).toBe("NT");
    expect(TEMPERAMENT_OF("ENFP")).toBe("NF");
    expect(TEMPERAMENT_OF("ISTP")).toBe("SP");
    expect(TEMPERAMENT_OF("ESFJ")).toBe("SJ");
    const counts = { NT: 0, NF: 0, SJ: 0, SP: 0 };
    for (const t of MBTI_TYPES) counts[TEMPERAMENT_OF(t)]++;
    expect(counts).toEqual({ NT: 4, NF: 4, SJ: 4, SP: 4 });
  });
});
