import { DRAWN_TYPES } from "@llmbit/core";
import { useEffect, useRef } from "react";

import { createPlayer, seedFrom } from "../pixel/player";
import type { Player } from "../pixel/player";
import { PALETTE, drawFrame, getCharacter } from "../pixel/shim";
import type { PixelCharacter } from "../pixel/shim";
import { subscribeTick } from "../pixel/ticker";

const SCALE = 4;
/** 초당 이동 픽셀 (캔버스 좌표) */
const SPEED_PX = 36;
const GAP = 24;
/** hop 여유로 캔버스 위쪽에 두는 빈 줄 (px) */
const TOP_PAD = 4;

interface Walker {
  character: PixelCharacter;
  player: Player;
  /** 캐릭터 한 장을 미리 그려 두는 오프스크린 캔버스. 프레임이 바뀔 때만 다시 그린다. */
  sprite: HTMLCanvasElement;
  lastIndex: number;
  x: number;
  dir: 1 | -1;
}

/**
 * 랜딩 하단 띠. 그려진 캐릭터들이 walk 프레임으로 좌우를 오가고 가장자리에서 방향을 바꾼다 (SPEC 10장).
 * 플레이어의 행동 스케줄러와 합쳐서, 동작(blink·wave·hop 등) 중에는 멈춰 섰다가 끝나면 다시 걷는다.
 * 페이지 공용 ticker 에 붙어 한 콜백으로 전부 그리고, 탭이 숨겨지면 ticker 가 멈춘다.
 * prefers-reduced-motion 이면 첫 프레임으로 줄만 세운다. 왼쪽으로 갈 때는 ctx.scale(-1, 1) 로 좌우를 뒤집는다.
 */
export function WalkStrip() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const characters = DRAWN_TYPES.map((t) => getCharacter(t)).filter(
    (c): c is PixelCharacter => c !== null,
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const box = boxRef.current;
    if (!canvas || !box || characters.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = characters[0]?.size ?? 32;
    const px = size * SCALE;
    const height = px + TOP_PAD;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const now0 = performance.now();

    const walkers: Walker[] = characters.map((character, i) => {
      const sprite = document.createElement("canvas");
      sprite.width = px;
      sprite.height = px;
      return {
        character,
        player: createPlayer(character, now0, {
          mode: "walk",
          seed: seedFrom(`${character.id}#walk#${i}#${Math.random()}`),
        }),
        sprite,
        lastIndex: -1,
        x: i * (px + GAP),
        dir: i % 2 === 0 ? 1 : -1,
      };
    });

    let unsubscribe: (() => void) | null = null;
    let last = now0;
    let width = 0;

    const paintSprite = (w: Walker, index: number) => {
      if (index === w.lastIndex) return;
      const frame = w.character.frames[index];
      const sctx = w.sprite.getContext("2d");
      if (!frame || !sctx) return;
      sctx.imageSmoothingEnabled = false;
      drawFrame(sctx, frame, PALETTE, SCALE);
      w.lastIndex = index;
    };

    const draw = (w: Walker, dx: number, dy: number) => {
      const x = Math.round(w.x) + dx * SCALE;
      const y = TOP_PAD - dy;
      if (w.dir === 1) {
        ctx.drawImage(w.sprite, x, y);
      } else {
        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(w.sprite, -x - px, y);
        ctx.restore();
      }
    };

    const clear = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;
    };

    const fit = () => {
      width = Math.max(px, Math.floor(box.clientWidth));
      canvas.width = width;
      canvas.height = height;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      // 좁아졌으면 안으로 들여온다
      for (const w of walkers) w.x = Math.min(w.x, width - px);
      if (media.matches) {
        // 정지: 가로로 고르게 세운다
        const slot = width / walkers.length;
        clear();
        walkers.forEach((w, i) => {
          w.x = Math.max(0, Math.min(width - px, i * slot + (slot - px) / 2));
          w.dir = 1;
          paintSprite(w, w.player.plan.idle[0] ?? 0);
          draw(w, 0, 0);
        });
      }
    };

    const tick = (now: number) => {
      const dt = Math.min(100, now - last) / 1000;
      last = now;
      clear();
      for (const w of walkers) {
        const f = w.player.frame(now);
        paintSprite(w, f.index);
        // 동작 중에는 멈춰 선다. 걷는 중에만 자리를 옮긴다.
        if (!f.busy) {
          w.x += w.dir * SPEED_PX * dt;
          if (w.x <= 0) {
            w.x = 0;
            w.dir = 1;
          } else if (w.x >= width - px) {
            w.x = width - px;
            w.dir = -1;
          }
        }
        draw(w, f.dx, f.dy);
      }
    };

    const stop = () => {
      unsubscribe?.();
      unsubscribe = null;
    };
    const start = () => {
      stop();
      fit();
      if (media.matches) return;
      last = performance.now();
      unsubscribe = subscribeTick(tick);
    };

    start();
    const ro = new ResizeObserver(() => fit());
    ro.observe(box);
    media.addEventListener("change", start);
    return () => {
      stop();
      ro.disconnect();
      media.removeEventListener("change", start);
    };
    // characters 는 DRAWN_TYPES 에서 오는 상수라 의존성에 넣지 않는다
  }, []);

  if (characters.length === 0) return null;

  return (
    <div ref={boxRef} className="walk-strip" aria-hidden="true">
      <canvas ref={canvasRef} className="pixel-canvas walk-canvas" />
    </div>
  );
}
