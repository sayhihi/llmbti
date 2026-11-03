/**
 * 픽셀 캐릭터 플레이어. 어떤 프레임을 언제 보여 줄지 정하는 순수 함수 모음.
 * 캔버스나 rAF 는 모른다. PixelCharacter (결과·카드) 와 WalkStrip (랜딩) 이 같이 쓴다.
 *
 * 세 겹으로 돈다.
 * 1. 기본 프레임: idle (또는 walk 모드면 walk) 을 fps 대로 반복.
 * 2. 자동 깜빡임: 3~5초 랜덤 간격으로 blink 를 120ms, 10번 중 1번은 200ms 뒤 한 번 더.
 * 3. 행동 스케줄러: 2~6초마다 주사위. 50% 는 skip, 나머지는 동작 풀에서 가중치로 하나.
 *    동작 중에는 새 주사위를 굴리지 않는다. 인스턴스마다 자기 시드의 PRNG 라 16마리가 제각각 움직인다.
 * wave (진입·탭) 는 셋보다 우선하고, 재생 중엔 깜빡이지 않는다.
 * anims 가 없거나 blink 가 없으면 frames[1] 을 blink, frames[0] 을 idle 로 본다.
 * prefers-reduced-motion 이면 전부 멈추고 idle[0] 고정.
 */

import type { PixelCharacter } from "@llmbti/core";

// ---------- 상수 (여기 한 곳) ----------

export const BLINK_MIN_MS = 3000;
export const BLINK_MAX_MS = 5000;
export const BLINK_HOLD_MS = 120;
export const DOUBLE_BLINK_CHANCE = 0.1;
/** 더블 블링크일 때 첫 깜빡임이 끝나고 두 번째가 시작되기까지 */
export const DOUBLE_BLINK_GAP_MS = 200;

export const BEHAVIOR_MIN_MS = 2000;
export const BEHAVIOR_MAX_MS = 6000;
export const BEHAVIOR_SKIP_CHANCE = 0.5;
/** 동작 풀 기본 가중치. 데이터에 있는 모르는 anim 이름은 UNKNOWN_ANIM_WEIGHT 로 들어간다. */
export const BEHAVIOR_WEIGHTS: Readonly<Record<string, number>> = {
  blink: 4,
  doubleBlink: 1,
  wave: 1,
  walkInPlace: 2,
  hop: 1,
  shuffle: 1,
};
export const UNKNOWN_ANIM_WEIGHT = 1;
/** walkInPlace: walk 프레임 몇 장 (걸음 수) */
export const WALK_IN_PLACE_STEPS: readonly [number, number] = [4, 6];
export const HOP_MS = 150;
/** hop: 위로 몇 px (CSS px) */
export const HOP_PX: readonly [number, number] = [2, 3];
/** shuffle: 옆으로 몇 칸 (스케일 단위, 부호는 랜덤) */
export const SHUFFLE_UNITS: readonly [number, number] = [1, 2];

/** 플레이어 예약어. 데이터의 anims 에서 동작 풀에 자동으로 넣지 않는 이름. */
const RESERVED_ANIMS = new Set(["idle", "blink", "wave", "walk"]);

// ---------- PRNG ----------

/** mulberry32. 같은 시드면 같은 수열. */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 문자열 → 32비트 시드 (FNV-1a). "ENFP#3" 처럼 유형+인덱스로 쓴다. */
export function seedFrom(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function between(rng: () => number, [lo, hi]: readonly [number, number]): number {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

// ---------- 시퀀스 ----------

export type PlayMode = "idle" | "walk";

/** 캐릭터 하나의 시퀀스 묶음. */
export interface AnimPlan {
  idle: number[];
  /** 비어 있으면 깜빡임 없음 */
  blink: number[];
  /** 비어 있으면 wave 없음 */
  wave: number[];
  /** walk 가 없으면 idle 과 같다. hasWalk 로 구분. */
  walk: number[];
  hasWalk: boolean;
  /** 예약어 밖의 이름 붙은 anim (유형별 시그니처 동작). 동작 풀에 가중치 1 로 들어간다. */
  extra: Record<string, number[]>;
  frameMs: number;
}

function nonEmpty(seq: number[] | undefined): number[] | null {
  return seq && seq.length > 0 ? [...seq] : null;
}

/** 캐릭터 데이터에서 시퀀스를 뽑는다. 없는 건 규칙대로 채운다. */
export function planAnims(character: PixelCharacter): AnimPlan {
  const anims = character.anims ?? {};
  const idle = nonEmpty(anims.idle) ?? [0];
  const blink = nonEmpty(anims.blink) ?? (character.frames.length > 1 ? [1] : []);
  const wave = nonEmpty(anims.wave) ?? [];
  const walk = nonEmpty(anims.walk);
  const extra: Record<string, number[]> = {};
  for (const [name, seq] of Object.entries(anims)) {
    if (RESERVED_ANIMS.has(name)) continue;
    const s = nonEmpty(seq);
    if (s) extra[name] = s;
  }
  return {
    idle,
    blink,
    wave,
    walk: walk ?? idle,
    hasWalk: walk !== null,
    extra,
    frameMs: 1000 / Math.max(1, character.fps),
  };
}

// ---------- 자동 깜빡임 ----------

export interface BlinkSchedule {
  /** 눈을 감기 시작하는 시각 (ms) */
  at: number;
  /** 두 번 깜빡이는지 */
  double: boolean;
}

export function scheduleBlink(now: number, rng: () => number = Math.random): BlinkSchedule {
  const wait = BLINK_MIN_MS + rng() * (BLINK_MAX_MS - BLINK_MIN_MS);
  return { at: now + wait, double: rng() < DOUBLE_BLINK_CHANCE };
}

/** 깜빡임이 완전히 끝나는 시각 */
export function blinkEndsAt(s: BlinkSchedule): number {
  return s.at + BLINK_HOLD_MS + (s.double ? DOUBLE_BLINK_GAP_MS + BLINK_HOLD_MS : 0);
}

/** 지금 눈을 감고 있어야 하는지 */
export function isEyesClosed(s: BlinkSchedule, now: number): boolean {
  if (now >= s.at && now < s.at + BLINK_HOLD_MS) return true;
  if (!s.double) return false;
  const second = s.at + BLINK_HOLD_MS + DOUBLE_BLINK_GAP_MS;
  return now >= second && now < second + BLINK_HOLD_MS;
}

// ---------- 행동 스케줄러 ----------

export type BehaviorKind =
  | "skip"
  | "blink"
  | "doubleBlink"
  | "wave"
  | "walkInPlace"
  | "hop"
  | "shuffle"
  | (string & {});

export interface Behavior {
  kind: BehaviorKind;
  /** 시작 시각 (절대 ms). nextBehavior 의 now 기준. */
  atMs: number;
  durationMs: number;
  /** 프레임 시퀀스 동작이면 순서대로 보여 줄 프레임 인덱스 */
  frames?: number[];
  /** shuffle: 옆으로 몇 칸 (스케일 단위, 부호 포함) */
  dx?: number;
  /** hop: 위로 몇 px */
  dy?: number;
}

/** 지금 플랜에서 고를 수 있는 동작과 가중치 */
export function behaviorPool(plan: AnimPlan): Array<[string, number]> {
  const pool: Array<[string, number]> = [];
  const w = (k: string) => BEHAVIOR_WEIGHTS[k] ?? UNKNOWN_ANIM_WEIGHT;
  if (plan.blink.length > 0) {
    pool.push(["blink", w("blink")]);
    pool.push(["doubleBlink", w("doubleBlink")]);
  }
  if (plan.wave.length > 0) pool.push(["wave", w("wave")]);
  if (plan.hasWalk) pool.push(["walkInPlace", w("walkInPlace")]);
  pool.push(["hop", w("hop")]);
  if (plan.hasWalk) pool.push(["shuffle", w("shuffle")]);
  for (const name of Object.keys(plan.extra)) pool.push([name, w(name)]);
  return pool;
}

function pickWeighted(rng: () => number, pool: Array<[string, number]>): string {
  const total = pool.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [k, w] of pool) {
    r -= w;
    if (r < 0) return k;
  }
  return pool[pool.length - 1]?.[0] ?? "skip";
}

function repeatFrames(seq: number[], count: number): number[] {
  return Array.from({ length: count }, (_, i) => seq[i % seq.length] ?? 0);
}

/**
 * 다음 동작을 정한다. 2~6초 뒤에 50% 는 skip, 나머지는 풀에서 가중치로.
 * 순수 함수: 같은 rng 수열이면 같은 결과.
 */
export function nextBehavior(rng: () => number, plan: AnimPlan, now = 0): Behavior {
  const atMs = now + BEHAVIOR_MIN_MS + rng() * (BEHAVIOR_MAX_MS - BEHAVIOR_MIN_MS);
  if (rng() < BEHAVIOR_SKIP_CHANCE) return { kind: "skip", atMs, durationMs: 0 };
  const kind = pickWeighted(rng, behaviorPool(plan));
  const f = plan.frameMs;
  switch (kind) {
    case "blink":
      return { kind, atMs, durationMs: BLINK_HOLD_MS, frames: plan.blink };
    case "doubleBlink":
      return {
        kind,
        atMs,
        durationMs: BLINK_HOLD_MS * 2 + DOUBLE_BLINK_GAP_MS,
        frames: plan.blink,
      };
    case "wave":
      return { kind, atMs, durationMs: plan.wave.length * f, frames: plan.wave };
    case "walkInPlace": {
      const frames = repeatFrames(plan.walk, between(rng, WALK_IN_PLACE_STEPS));
      return { kind, atMs, durationMs: frames.length * f, frames };
    }
    case "hop":
      return { kind, atMs, durationMs: HOP_MS, dy: between(rng, HOP_PX) };
    case "shuffle": {
      // 나갔다가 돌아온다: walk 한 바퀴씩
      const frames = repeatFrames(plan.walk, plan.walk.length * 2);
      const dx = between(rng, SHUFFLE_UNITS) * (rng() < 0.5 ? -1 : 1);
      return { kind, atMs, durationMs: frames.length * f, frames, dx };
    }
    default: {
      const frames = plan.extra[kind] ?? plan.idle;
      return { kind, atMs, durationMs: frames.length * f, frames };
    }
  }
}

export function isBehaviorRunning(b: Behavior, now: number): boolean {
  return b.kind !== "skip" && now >= b.atMs && now < b.atMs + b.durationMs;
}

export interface Offset {
  /** 스케일 단위 (캐릭터 픽셀) */
  dx: number;
  /** CSS px, 양수가 위 */
  dy: number;
}

/** 동작 진행 중 캔버스를 얼마나 옮길지 */
export function behaviorOffset(b: Behavior, now: number): Offset {
  if (!isBehaviorRunning(b, now)) return { dx: 0, dy: 0 };
  const t = (now - b.atMs) / b.durationMs; // 0..1
  if (b.kind === "hop") {
    // 올라갔다 내려온다
    return { dx: 0, dy: Math.round((b.dy ?? 0) * (t < 0.5 ? t * 2 : (1 - t) * 2)) || 0 };
  }
  if (b.kind === "shuffle") {
    // 앞 절반 나가고 뒤 절반 돌아온다
    return { dx: Math.round((b.dx ?? 0) * (t < 0.5 ? t * 2 : (1 - t) * 2)) || 0, dy: 0 };
  }
  return { dx: 0, dy: 0 };
}

/** 동작 진행 중 보여 줄 프레임. 프레임이 없는 동작(hop) 이면 null. */
export function behaviorFrame(b: Behavior, now: number, plan: AnimPlan): number | null {
  if (!isBehaviorRunning(b, now)) return null;
  const elapsed = now - b.atMs;
  if (b.kind === "blink" || b.kind === "doubleBlink") {
    const closed = isEyesClosed({ at: b.atMs, double: b.kind === "doubleBlink" }, now);
    return closed ? (b.frames?.[0] ?? null) : plan.idle[0] ?? 0;
  }
  if (!b.frames || b.frames.length === 0) return null;
  const n = Math.min(b.frames.length - 1, Math.floor(elapsed / plan.frameMs));
  return b.frames[n] ?? null;
}

// ---------- 상태 머신 ----------

export interface PlayerState {
  /** 프레임 순서를 세기 시작한 시각 */
  origin: number;
  /** wave 재생 중이면 시작 시각, 아니면 null */
  waveStart: number | null;
  blink: BlinkSchedule | null;
  /** 예약됐거나 진행 중인 동작. null 이면 다음 틱에 주사위를 굴린다. */
  behavior: Behavior | null;
}

export interface StepOptions {
  mode?: PlayMode;
  /** prefers-reduced-motion. true 면 idle[0] 고정 */
  reduced?: boolean;
  /** 0..1 난수. 테스트에서 고정값을 넣는다. */
  rng?: () => number;
  /** false 면 행동 스케줄러를 끈다 (깜빡임만) */
  behaviors?: boolean;
}

export interface Frame {
  index: number;
  dx: number;
  dy: number;
  /** wave 나 동작이 진행 중이라 (걷는 캐릭터라면) 제자리에 있어야 하는지 */
  busy: boolean;
}

export function createPlayerState(now: number, intro: boolean, plan: AnimPlan): PlayerState {
  return {
    origin: now,
    waveStart: intro && plan.wave.length > 0 ? now : null,
    blink: null,
    behavior: null,
  };
}

/**
 * 탭 반응. wave 가 있으면 wave 를 다시 재생하고, 없으면 바로 더블 블링크로 대신한다.
 */
export function triggerWave(state: PlayerState, now: number, plan: AnimPlan): PlayerState {
  if (plan.wave.length > 0) return { ...state, waveStart: now, behavior: null };
  return { ...state, blink: { at: now, double: true }, behavior: null };
}

/**
 * 한 틱. 지금 보여 줄 프레임과 다음 상태를 돌려준다. 상태를 바꾸지 않는다.
 */
export function stepPlayer(
  plan: AnimPlan,
  state: PlayerState,
  now: number,
  opts: StepOptions = {},
): { frame: Frame; state: PlayerState } {
  const mode = opts.mode ?? "idle";
  const base = mode === "walk" ? plan.walk : plan.idle;
  const rng = opts.rng ?? Math.random;
  const still = (index: number, busy = false): Frame => ({ index, dx: 0, dy: 0, busy });

  if (opts.reduced) return { frame: still(base[0] ?? 0), state };

  let next = state;

  // 1. wave (진입·탭). 깜빡임도 동작도 없다.
  if (next.waveStart !== null && plan.wave.length > 0) {
    const n = Math.floor((now - next.waveStart) / plan.frameMs);
    if (n < plan.wave.length) {
      return { frame: still(plan.wave[Math.max(0, n)] ?? 0, true), state: next };
    }
    // wave 끝. 깜빡임과 주사위는 지금부터 다시 센다.
    next = { ...next, waveStart: null, blink: scheduleBlink(now, rng), behavior: null };
  }

  // 2. 자동 깜빡임 스케줄은 항상 돈다
  let blink = next.blink;
  if (!blink || now >= blinkEndsAt(blink)) blink = scheduleBlink(now, rng);
  if (blink !== next.blink) next = { ...next, blink };

  // 3. 행동 스케줄러
  if (opts.behaviors !== false) {
    let behavior = next.behavior;
    if (!behavior || now >= behavior.atMs + behavior.durationMs) {
      behavior = nextBehavior(rng, plan, now);
      next = { ...next, behavior };
    }
    if (isBehaviorRunning(behavior, now)) {
      const idx = behaviorFrame(behavior, now, plan);
      const off = behaviorOffset(behavior, now);
      const n = Math.max(0, Math.floor((now - next.origin) / plan.frameMs));
      return {
        frame: { index: idx ?? base[n % base.length] ?? 0, dx: off.dx, dy: off.dy, busy: true },
        state: next,
      };
    }
  }

  // 4. 기본 프레임 + 깜빡임
  const n = Math.max(0, Math.floor((now - next.origin) / plan.frameMs));
  if (plan.blink.length > 0 && isEyesClosed(blink, now)) {
    return { frame: still(plan.blink[n % plan.blink.length] ?? 0), state: next };
  }
  return { frame: still(base[n % base.length] ?? 0), state: next };
}

// ---------- 편의 객체 ----------

/** 컴포넌트가 rAF 안에서 frame(now) 만 부른다. */
export interface Player {
  readonly plan: AnimPlan;
  frame(now: number): Frame;
  tap(now: number): void;
}

export interface PlayerOptions {
  intro?: boolean;
  mode?: PlayMode;
  reduced?: boolean;
  /** 시드. 없으면 Math.random 으로 하나 뽑는다. 같은 페이지의 캐릭터마다 달라야 한다. */
  seed?: number;
  behaviors?: boolean;
}

export function createPlayer(
  character: PixelCharacter,
  now: number,
  options: PlayerOptions = {},
): Player {
  const plan = planAnims(character);
  const rng = createRng(options.seed ?? Math.floor(Math.random() * 0xffffffff));
  let state = createPlayerState(now, options.intro ?? false, plan);
  const stepOpts: StepOptions = {
    mode: options.mode,
    reduced: options.reduced,
    rng,
    behaviors: options.behaviors,
  };
  return {
    plan,
    frame(t) {
      const r = stepPlayer(plan, state, t, stepOpts);
      state = r.state;
      return r.frame;
    },
    tap(t) {
      state = triggerWave(state, t, plan);
    },
  };
}
