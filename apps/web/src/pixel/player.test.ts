import type { PixelCharacter } from "@llmbti/core";
import { describe, expect, it } from "vitest";

import {
  BEHAVIOR_MAX_MS,
  BEHAVIOR_MIN_MS,
  BEHAVIOR_WEIGHTS,
  BLINK_HOLD_MS,
  BLINK_MAX_MS,
  BLINK_MIN_MS,
  DOUBLE_BLINK_GAP_MS,
  HOP_MS,
  behaviorFrame,
  behaviorOffset,
  behaviorPool,
  blinkEndsAt,
  createPlayer,
  createPlayerState,
  createRng,
  isEyesClosed,
  nextBehavior,
  planAnims,
  scheduleBlink,
  seedFrom,
  stepPlayer,
  triggerWave,
} from "./player";

const row = ".".repeat(32);
const frame = () => Array.from({ length: 32 }, () => row);

function character(frameCount: number, anims?: PixelCharacter["anims"]): PixelCharacter {
  return {
    id: "TEST",
    size: 32,
    fps: 10, // frameMs 100
    frames: Array.from({ length: frameCount }, frame),
    ...(anims ? { anims } : {}),
  };
}

/** 순서대로 값을 내놓는 가짜 난수 */
function seq(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length] ?? 0;
}

const FULL = { idle: [0], blink: [1], wave: [2, 3, 2, 3, 0], walk: [4, 5] };
/** 스케줄러를 끈 옵션. 깜빡임 타이밍만 본다. */
const noBeh = { behaviors: false };

describe("planAnims", () => {
  it("anims 가 없으면 frames[0] 을 idle, frames[1] 을 blink 로 본다", () => {
    const plan = planAnims(character(2));
    expect(plan.idle).toEqual([0]);
    expect(plan.blink).toEqual([1]);
    expect(plan.wave).toEqual([]);
    expect(plan.walk).toEqual([0]);
    expect(plan.hasWalk).toBe(false);
    expect(plan.extra).toEqual({});
    expect(plan.frameMs).toBe(100);
  });

  it("프레임이 하나면 blink 가 없다", () => {
    expect(planAnims(character(1)).blink).toEqual([]);
  });

  it("anims 가 있으면 그대로 쓰고 blink 만 없으면 frames[1] 로 채운다", () => {
    const plan = planAnims(character(6, { idle: [0], wave: [2, 3, 2, 3, 0], walk: [4, 5] }));
    expect(plan.idle).toEqual([0]);
    expect(plan.blink).toEqual([1]);
    expect(plan.wave).toEqual([2, 3, 2, 3, 0]);
    expect(plan.walk).toEqual([4, 5]);
    expect(plan.hasWalk).toBe(true);
  });

  it("예약어 밖의 anim 은 extra 로 모은다", () => {
    const plan = planAnims(character(8, { ...FULL, flicker: [6, 7, 6] }));
    expect(plan.extra).toEqual({ flicker: [6, 7, 6] });
  });
});

describe("scheduleBlink / isEyesClosed", () => {
  it("3~5초 사이에 잡히고 10% 확률로 더블", () => {
    const a = scheduleBlink(1000, seq([0, 0.5]));
    expect(a.at).toBe(1000 + BLINK_MIN_MS);
    expect(a.double).toBe(false);
    const b = scheduleBlink(1000, seq([1, 0.05]));
    expect(b.at).toBe(1000 + BLINK_MAX_MS);
    expect(b.double).toBe(true);
  });

  it("단일 블링크는 120ms 만 감는다", () => {
    const s = { at: 5000, double: false };
    expect(isEyesClosed(s, 4999)).toBe(false);
    expect(isEyesClosed(s, 5000)).toBe(true);
    expect(isEyesClosed(s, 5000 + BLINK_HOLD_MS - 1)).toBe(true);
    expect(isEyesClosed(s, 5000 + BLINK_HOLD_MS)).toBe(false);
    expect(blinkEndsAt(s)).toBe(5000 + BLINK_HOLD_MS);
  });

  it("더블 블링크는 200ms 뒤에 한 번 더 감는다", () => {
    const s = { at: 5000, double: true };
    const second = 5000 + BLINK_HOLD_MS + DOUBLE_BLINK_GAP_MS;
    expect(isEyesClosed(s, second - 1)).toBe(false);
    expect(isEyesClosed(s, second)).toBe(true);
    expect(isEyesClosed(s, second + BLINK_HOLD_MS)).toBe(false);
    expect(blinkEndsAt(s)).toBe(second + BLINK_HOLD_MS);
  });
});

describe("stepPlayer: 깜빡임 타이밍", () => {
  const plan = planAnims(character(6, FULL));

  it("idle 을 돌리다가 예정된 시각에 blink 프레임을 끼운다", () => {
    const rng = seq([0, 0.5]); // 3000ms 뒤, 단일
    let state = createPlayerState(0, false, plan);
    const at = (now: number) => {
      const r = stepPlayer(plan, state, now, { rng, ...noBeh });
      state = r.state;
      return r.frame.index;
    };
    expect(at(0)).toBe(0);
    expect(at(2999)).toBe(0);
    expect(at(3000)).toBe(1);
    expect(at(3000 + BLINK_HOLD_MS - 1)).toBe(1);
    expect(at(3000 + BLINK_HOLD_MS)).toBe(0);
  });

  it("깜빡임이 끝나면 다음 깜빡임을 새로 잡는다", () => {
    const rng = seq([0, 0.5]);
    let state = createPlayerState(0, false, plan);
    state = stepPlayer(plan, state, 0, { rng, ...noBeh }).state;
    expect(state.blink?.at).toBe(3000);
    const after = stepPlayer(plan, state, 3200, { rng, ...noBeh });
    expect(after.frame.index).toBe(0);
    expect(after.state.blink?.at).toBe(3200 + 3000);
  });

  it("wave 재생 중에는 깜빡이지 않고, 끝나면 idle 로 돌아온다", () => {
    const rng = seq([0, 0.5]);
    let state = createPlayerState(0, true, plan);
    state = stepPlayer(plan, state, 0, { rng, ...noBeh }).state;
    state = triggerWave(state, 2900, plan);
    const during = stepPlayer(plan, state, 3000, { rng, ...noBeh }); // wave 2번째 프레임
    expect(during.frame.index).toBe(3);
    expect(during.frame.busy).toBe(true);
    expect(during.state.waveStart).toBe(2900);
    const done = stepPlayer(plan, during.state, 2900 + 5 * 100, { rng, ...noBeh });
    expect(done.frame.index).toBe(0);
    expect(done.frame.busy).toBe(false);
    expect(done.state.waveStart).toBeNull();
    // 끝난 시각 기준으로 깜빡임이 다시 잡혔다
    expect(done.state.blink?.at).toBe(3400 + 3000);
  });

  it("intro 면 처음부터 wave 를 돈다", () => {
    const state = createPlayerState(1000, true, plan);
    expect(state.waveStart).toBe(1000);
    expect(stepPlayer(plan, state, 1000, noBeh).frame.index).toBe(2);
    expect(stepPlayer(plan, state, 1350, noBeh).frame.index).toBe(3);
  });

  it("walk 모드는 walk 프레임을 돌리고 blink 도 끼운다", () => {
    const rng = seq([0, 0.5]);
    let state = createPlayerState(0, false, plan);
    const r1 = stepPlayer(plan, state, 0, { mode: "walk", rng, ...noBeh });
    state = r1.state;
    expect(r1.frame.index).toBe(4);
    expect(stepPlayer(plan, state, 100, { mode: "walk", rng, ...noBeh }).frame.index).toBe(5);
    expect(stepPlayer(plan, state, 3000, { mode: "walk", rng, ...noBeh }).frame.index).toBe(1);
  });

  it("reduced motion 이면 첫 프레임에 고정되고 깜빡이지 않는다", () => {
    const state = createPlayerState(0, true, plan);
    expect(stepPlayer(plan, state, 0, { reduced: true }).frame.index).toBe(0);
    expect(stepPlayer(plan, state, 3000, { reduced: true, rng: seq([0]) }).frame.index).toBe(0);
    expect(stepPlayer(plan, state, 0, { reduced: true, mode: "walk" }).frame.index).toBe(4);
  });

  it("wave 가 없는 캐릭터(지금 3종)를 탭하면 바로 더블 블링크", () => {
    const two = planAnims(character(2));
    let state = createPlayerState(0, true, two);
    expect(state.waveStart).toBeNull();
    state = triggerWave(state, 500, two);
    const at = (now: number) => stepPlayer(two, state, now, noBeh).frame.index;
    expect(at(500)).toBe(1);
    expect(at(500 + BLINK_HOLD_MS + 10)).toBe(0);
    expect(at(500 + BLINK_HOLD_MS + DOUBLE_BLINK_GAP_MS + 10)).toBe(1);
  });
});

describe("nextBehavior", () => {
  const plan = planAnims(character(6, FULL));

  it("시드가 같으면 결정적이다", () => {
    const a = Array.from({ length: 20 }, () => nextBehavior(createRng(42), plan, 0));
    const b = nextBehavior(createRng(42), plan, 0);
    for (const x of a) expect(x).toEqual(b);
    // 다른 시드는 (대개) 다르다
    const rngA = createRng(seedFrom("ENFP#0"));
    const rngB = createRng(seedFrom("ENFP#1"));
    const runA = Array.from({ length: 10 }, () => nextBehavior(rngA, plan, 0).kind);
    const runB = Array.from({ length: 10 }, () => nextBehavior(rngB, plan, 0).kind);
    expect(runA).not.toEqual(runB);
  });

  it("2~6초 뒤에 잡히고 skip 비율은 대략 50%", () => {
    const rng = createRng(7);
    let skips = 0;
    const N = 4000;
    for (let i = 0; i < N; i++) {
      const b = nextBehavior(rng, plan, 1000);
      expect(b.atMs).toBeGreaterThanOrEqual(1000 + BEHAVIOR_MIN_MS);
      expect(b.atMs).toBeLessThanOrEqual(1000 + BEHAVIOR_MAX_MS);
      if (b.kind === "skip") skips++;
    }
    expect(skips / N).toBeGreaterThan(0.45);
    expect(skips / N).toBeLessThan(0.55);
  });

  it("가중치가 반영된다 (blink 가 doubleBlink 의 4배쯤)", () => {
    const rng = createRng(99);
    const count: Record<string, number> = {};
    for (let i = 0; i < 8000; i++) {
      const b = nextBehavior(rng, plan, 0);
      count[b.kind] = (count[b.kind] ?? 0) + 1;
    }
    const ratio = (count.blink ?? 0) / (count.doubleBlink ?? 1);
    const expected = BEHAVIOR_WEIGHTS.blink! / BEHAVIOR_WEIGHTS.doubleBlink!;
    expect(ratio).toBeGreaterThan(expected * 0.7);
    expect(ratio).toBeLessThan(expected * 1.3);
    expect(count.walkInPlace ?? 0).toBeGreaterThan(count.hop ?? 0);
    for (const k of Object.keys(BEHAVIOR_WEIGHTS)) expect(count[k] ?? 0).toBeGreaterThan(0);
  });

  it("anims 가 없으면 blink 와 hop 만 나온다", () => {
    const bare = planAnims(character(2));
    expect(behaviorPool(bare).map(([k]) => k)).toEqual(["blink", "doubleBlink", "hop"]);
    const rng = createRng(3);
    const kinds = new Set<string>();
    for (let i = 0; i < 500; i++) kinds.add(nextBehavior(rng, bare, 0).kind);
    for (const k of kinds) expect(["skip", "blink", "doubleBlink", "hop"]).toContain(k);
    expect(kinds.has("hop")).toBe(true);
    expect(kinds.has("blink")).toBe(true);
  });

  it("모르는 anim 이름은 가중치 1 로 풀에 들어간다", () => {
    const sig = planAnims(character(8, { ...FULL, flicker: [6, 7, 6] }));
    const pool = behaviorPool(sig);
    expect(pool).toContainEqual(["flicker", 1]);
    const rng = createRng(11);
    let found: ReturnType<typeof nextBehavior> | null = null;
    for (let i = 0; i < 2000 && !found; i++) {
      const b = nextBehavior(rng, sig, 0);
      if (b.kind === "flicker") found = b;
    }
    expect(found?.frames).toEqual([6, 7, 6]);
    expect(found?.durationMs).toBe(300);
  });

  it("동작마다 프레임과 길이가 맞는다", () => {
    const rng = createRng(5);
    const seen: Record<string, ReturnType<typeof nextBehavior>> = {};
    for (let i = 0; i < 3000; i++) {
      const b = nextBehavior(rng, plan, 0);
      if (!(b.kind in seen)) seen[b.kind] = b;
    }
    expect(seen.blink?.durationMs).toBe(BLINK_HOLD_MS);
    expect(seen.doubleBlink?.durationMs).toBe(BLINK_HOLD_MS * 2 + DOUBLE_BLINK_GAP_MS);
    expect(seen.wave?.frames).toEqual(FULL.wave);
    expect(seen.wave?.durationMs).toBe(500);
    const wip = seen.walkInPlace!;
    expect(wip.frames!.length).toBeGreaterThanOrEqual(4);
    expect(wip.frames!.length).toBeLessThanOrEqual(6);
    expect(wip.durationMs).toBe(wip.frames!.length * 100);
    expect(seen.hop?.durationMs).toBe(HOP_MS);
    expect([2, 3]).toContain(seen.hop?.dy);
    expect(seen.shuffle?.frames).toEqual([4, 5, 4, 5]);
    expect([1, 2]).toContain(Math.abs(seen.shuffle?.dx ?? 0));
  });
});

describe("behaviorFrame / behaviorOffset", () => {
  const plan = planAnims(character(6, FULL));

  it("hop 은 프레임 없이 위로 갔다 내려온다", () => {
    const b = { kind: "hop", atMs: 1000, durationMs: HOP_MS, dy: 3 };
    expect(behaviorFrame(b, 1000, plan)).toBeNull();
    expect(behaviorOffset(b, 999)).toEqual({ dx: 0, dy: 0 });
    expect(behaviorOffset(b, 1000 + HOP_MS / 2).dy).toBe(3);
    expect(behaviorOffset(b, 1000 + HOP_MS)).toEqual({ dx: 0, dy: 0 });
  });

  it("shuffle 은 walk 프레임을 돌리며 옆으로 갔다 돌아온다", () => {
    const b = { kind: "shuffle", atMs: 0, durationMs: 400, frames: [4, 5, 4, 5], dx: -2 };
    expect(behaviorFrame(b, 0, plan)).toBe(4);
    expect(behaviorFrame(b, 150, plan)).toBe(5);
    expect(behaviorOffset(b, 200).dx).toBe(-2);
    expect(behaviorOffset(b, 399).dx).toBe(0);
  });

  it("doubleBlink 는 감았다 떴다 다시 감는다", () => {
    const b = {
      kind: "doubleBlink",
      atMs: 0,
      durationMs: BLINK_HOLD_MS * 2 + DOUBLE_BLINK_GAP_MS,
      frames: [1],
    };
    expect(behaviorFrame(b, 10, plan)).toBe(1);
    expect(behaviorFrame(b, BLINK_HOLD_MS + 10, plan)).toBe(0);
    expect(behaviorFrame(b, BLINK_HOLD_MS + DOUBLE_BLINK_GAP_MS + 10, plan)).toBe(1);
  });
});

describe("stepPlayer: 스케줄러", () => {
  const plan = planAnims(character(6, FULL));

  it("예약된 동작이 시작되면 busy 가 되고 끝나면 새 주사위를 굴린다", () => {
    // 주사위: 대기 2000ms (0), skip 아님 (0.9), 풀에서 hop 선택, dy
    // 풀 순서 blink4 doubleBlink1 wave1 walkInPlace2 hop1 shuffle1 = 총 10. hop 은 8..9 구간 → 0.85
    const rng = seq([0, 0.5, 0, 0.9, 0.85, 0.5]);
    let state = createPlayerState(0, false, plan);
    let r = stepPlayer(plan, state, 0, { rng });
    state = r.state;
    expect(state.behavior?.kind).toBe("hop");
    expect(state.behavior?.atMs).toBe(2000);
    expect(r.frame.busy).toBe(false);
    r = stepPlayer(plan, state, 2000 + HOP_MS / 2, { rng });
    expect(r.frame.busy).toBe(true);
    expect(r.frame.dy).toBeGreaterThan(0);
    expect(r.state.behavior).toBe(state.behavior); // 실행 중엔 새로 안 굴린다
    const after = stepPlayer(plan, r.state, 2000 + HOP_MS + 1, { rng });
    expect(after.frame.busy).toBe(false);
    expect(after.state.behavior).not.toBe(state.behavior);
    expect(after.state.behavior?.atMs).toBeGreaterThanOrEqual(2000 + HOP_MS + 1 + BEHAVIOR_MIN_MS);
  });

  it("wave 중에는 동작을 굴리지 않고 끝나면 새로 잡는다", () => {
    let state = createPlayerState(0, true, plan);
    const r = stepPlayer(plan, state, 100, { rng: createRng(1) });
    expect(r.frame.busy).toBe(true);
    expect(r.state.behavior).toBeNull();
    state = stepPlayer(plan, r.state, 600, { rng: createRng(1) }).state;
    expect(state.behavior).not.toBeNull();
  });

  it("탭하면 진행 중인 동작을 버리고 wave", () => {
    const state = { ...createPlayerState(0, false, plan), behavior: { kind: "hop", atMs: 0, durationMs: 150, dy: 2 } };
    const tapped = triggerWave(state, 50, plan);
    expect(tapped.behavior).toBeNull();
    expect(stepPlayer(plan, tapped, 50).frame.index).toBe(2);
  });
});

describe("createPlayer", () => {
  it("frame(now) 가 상태를 이어 가고 시드가 같으면 같은 결과", () => {
    const a = createPlayer(character(6, FULL), 0, { seed: 123 });
    const b = createPlayer(character(6, FULL), 0, { seed: 123 });
    const sample = (p: typeof a) =>
      Array.from({ length: 200 }, (_, i) => p.frame(i * 50)).map((f) => `${f.index}:${f.dy}`);
    expect(sample(a)).toEqual(sample(b));
    const c = createPlayer(character(6, FULL), 0, { seed: 456 });
    expect(sample(c)).not.toEqual(sample(a));
  });

  it("탭 반응", () => {
    const p = createPlayer(character(2), 0, { seed: 1, behaviors: false });
    expect(p.frame(0).index).toBe(0);
    p.tap(4000);
    expect(p.frame(4000).index).toBe(1);
  });
});
